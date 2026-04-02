/**
 * Update User Field operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_FIELDS_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import {
	runUserFieldLookupPreflightGate,
	USER_FIELD_NOT_FOUND_ERROR_CODE,
	USER_FIELD_NOT_FOUND_HINT,
	USER_FIELD_NOT_FOUND_MESSAGE,
} from '../shared/preflight';
import {
	INVALID_INPUT_MODE,
	parseFieldArrayInput,
	parseFieldPayloadInput,
	INVALID_USER_FIELD_ID,
	INVALID_USER_FIELD_NAME,
	EMPTY_DROPDOWN_OPTIONS,
	pushUserFieldRecoverableError,
	userFieldIdLocator,
	validateUserFieldInputMode,
	validateUpdateFieldPayload,
	validateUserFieldId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userFields', 'update');

const properties: INodeProperties[] = [
	userFieldIdLocator,
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Agent/Tool Setup Fields', value: 'agentTool' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		description:
			'Choose how to define the schema-update payload for a user field (not user profile data)',
		hint: 'Using Fields Below is the standard path for common updates. Use Using JSON only for advanced update payloads.',
	},
	{
		displayName:
			'Agent/Tool Setup mode keeps all update inputs visible and uses a single JSON field for dropdown options.',
		name: 'updateUserFieldAgentToolModeNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description:
			'New display name for the user-field schema definition (maximum 30 characters). This renames the field definition label, not a per-user value.',
		displayOptions: {
			show: {
				inputMode: ['structured', 'agentTool'],
			},
		},
	},
	{
		displayName: 'Mandatory',
		name: 'mandatoryMode',
		type: 'options',
		options: [
			{ name: 'Not Set', value: 'unset' },
			{ name: 'True', value: 'true' },
			{ name: 'False', value: 'false' },
		],
		default: 'unset',
		description:
			'Whether this schema field is required across user profiles in the organization. Set true/false only when you want to change this rule.',
		displayOptions: {
			show: {
				inputMode: ['structured', 'agentTool'],
			},
		},
	},
	{
		displayName: 'Encrypted',
		name: 'encryptedMode',
		type: 'options',
		options: [
			{ name: 'Not Set', value: 'unset' },
			{ name: 'True', value: 'true' },
			{ name: 'False', value: 'false' },
		],
		default: 'unset',
		description:
			'Whether Cliq should mark values stored for this schema field as encrypted. Once encrypted, this cannot be reversed.',
		hint: 'Use for sensitive profile fields.',
		displayOptions: {
			show: {
				inputMode: ['structured', 'agentTool'],
			},
		},
	},
	{
		displayName: 'Edit Permission',
		name: 'editPermissionMode',
		type: 'options',
		options: [
			{ name: 'Not Set', value: 'unset' },
			{ name: 'True', value: 'true' },
			{ name: 'False', value: 'false' },
		],
		default: 'unset',
		description:
			'Whether end users can edit their own profile value for this schema field. Does not grant permission to change the field definition itself.',
		displayOptions: {
			show: {
				inputMode: ['structured', 'agentTool'],
			},
		},
	},
	{
		displayName: 'Replace Dropdown Options',
		name: 'replaceOptions',
		type: 'boolean',
		default: false,
		description:
			'Whether this update should replace drop-down options on the field schema definition',
		hint: 'Unlike Add User Field, Update uses option objects with required name and optional id.',
		displayOptions: {
			show: {
				inputMode: ['structured', 'agentTool'],
			},
		},
	},
	{
		displayName: 'Dropdown Options',
		name: 'options',
		type: 'fixedCollection',
		placeholder: 'Add Option',
		default: {},
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: 'Option',
				name: 'values',
				values: [
					{
						displayName: 'Option Name',
						name: 'name',
						type: 'string',
						default: '',
						required: true,
						description:
							'Display name for this field-definition dropdown option. Required for each option entry.',
					},
					{
						displayName: 'Option ID',
						name: 'id',
						type: 'string',
						default: '',
						description:
							'Existing field-definition option ID to update. Leave empty to add a new option.',
					},
				],
			},
		],
		displayOptions: {
			show: {
				inputMode: ['structured'],
				replaceOptions: [true],
			},
		},
	},
	{
		displayName: 'Dropdown Options (JSON)',
		name: 'agentToolOptions',
		type: 'json',
		default: '[]',
		description:
			'JSON array of dropdown option objects. Each entry needs a required name and optional existing ID.',
		hint: 'Example: [{"id":"1901318000003603021","name":"Yes"},{"name":"Prefer not to say"}].',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Update Definition (JSON)',
		name: 'updateDefinitionRaw',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'JSON schema-update payload for a user field definition. This is field configuration, not user profile data.',
		hint: 'Allowed keys: name, mandatory, encrypted, edit_permission, options.',
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
	},
	...getSimplifyParameters('userField', 'userField', 'update'),
	{
		displayName: `<a href="https://www.zoho.com/cliq/help/restapi/v2/#userfields-update" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> — Required scope: <code>${requiredScope}</code>. Updates a user-field schema definition (name, rules, options), not user profile values.`,
		name: 'updateUserFieldDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User Field/Update User Field Details as AI Tool Setup Guide: <a href="${USER_FIELDS_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateUserFieldAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userField'],
		operation: ['update'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let sanitizedFieldId: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const fieldId = this.getNodeParameter('fieldId', i, '', {
				extractValue: true,
			}) as string;
			sanitizedFieldId = validateUserFieldId(this, fieldId, i);
			const inputMode = validateUserFieldInputMode(
				this,
				this.getNodeParameter('inputMode', i, 'structured'),
				i,
			);
			let body: IDataObject;

			if (inputMode === 'structured' || inputMode === 'agentTool') {
				body = {};
				const name = String(this.getNodeParameter('name', i, '')).trim();
				if (name) {
					body.name = name;
				}

				const mandatoryMode = this.getNodeParameter('mandatoryMode', i, 'unset') as
					| 'unset'
					| 'true'
					| 'false';
				if (mandatoryMode !== 'unset') {
					body.mandatory = mandatoryMode === 'true';
				}

				const encryptedMode = this.getNodeParameter('encryptedMode', i, 'unset') as
					| 'unset'
					| 'true'
					| 'false';
				if (encryptedMode !== 'unset') {
					body.encrypted = encryptedMode === 'true';
				}

				const editPermissionMode = this.getNodeParameter('editPermissionMode', i, 'unset') as
					| 'unset'
					| 'true'
					| 'false';
				if (editPermissionMode !== 'unset') {
					body.edit_permission = editPermissionMode === 'true';
				}

				const replaceOptions = this.getNodeParameter('replaceOptions', i, false) as boolean;
				if (replaceOptions) {
					if (inputMode === 'agentTool') {
						const agentToolOptions = this.getNodeParameter('agentToolOptions', i, '[]') as unknown;
						body.options = parseFieldArrayInput(this, agentToolOptions, i, 'Dropdown Options');
					} else {
						const optionsInput = this.getNodeParameter('options', i, {}) as IDataObject;
						const optionValues = ((optionsInput.values as IDataObject[] | undefined) ?? []).map(
							(option) => {
								const normalized: IDataObject = {
									name: String(option.name ?? '').trim(),
								};
								const id = String(option.id ?? '').trim();
								if (id) {
									normalized.id = id;
								}
								return normalized;
							},
						);
						body.options = optionValues;
					}
				}
			} else {
				const updateDefinitionRaw = this.getNodeParameter('updateDefinitionRaw', i, {}) as unknown;
				body = parseFieldPayloadInput(this, updateDefinitionRaw, i, 'Update Definition');
			}

			body = validateUpdateFieldPayload(this, body, i, 'Update Definition');
			await runUserFieldLookupPreflightGate(this, i, grantedScopes, sanitizedFieldId);

			const endpoint = `/api/v2/userfields/${encodeURIComponent(sanitizedFieldId)}`;
			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, body);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('userField');
			const simplified = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
				'data',
			);
			const json = { updated: true, ...simplified };

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushUserFieldRecoverableError(this, returnData, i, 'update', error, {
					contextFields: {
						...(sanitizedFieldId ? { field_id: sanitizedFieldId } : {}),
					},
					messageMappings: [
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === USER_FIELD_NOT_FOUND_ERROR_CODE,
							reason: USER_FIELD_NOT_FOUND_ERROR_CODE,
							messageOverride: USER_FIELD_NOT_FOUND_MESSAGE,
							hint: USER_FIELD_NOT_FOUND_HINT,
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === INVALID_USER_FIELD_ID,
							reason: INVALID_USER_FIELD_ID,
							hint: 'Use the exact field_id returned by Retrieve All User Fields or Retrieve User Field before updating.',
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === INVALID_USER_FIELD_NAME,
							reason: INVALID_USER_FIELD_NAME,
							hint: 'Use a user field name that is 30 characters or fewer.',
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === EMPTY_DROPDOWN_OPTIONS,
							reason: EMPTY_DROPDOWN_OPTIONS,
							messageOverride: 'options cannot be empty when dropdown options are being replaced.',
							hint: 'Provide at least one dropdown option object when replacing dropdown options.',
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === INVALID_INPUT_MODE,
							reason: INVALID_INPUT_MODE,
						},
					],
				})
			) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
