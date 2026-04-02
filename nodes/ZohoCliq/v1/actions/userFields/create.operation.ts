/**
 * Create User Field operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_FIELDS_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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
	runUserFieldCreateLimitPreflight,
	USER_FIELD_CUSTOM_LIMIT_REACHED_ERROR_CODE,
	USER_FIELD_CUSTOM_LIMIT_REACHED_HINT,
	USER_FIELD_CUSTOM_LIMIT_REACHED_MESSAGE,
} from '../shared/preflight';
import {
	DROPDOWN_OPTIONS_NOT_ALLOWED,
	DROPDOWN_OPTIONS_REQUIRED,
	EMPTY_DROPDOWN_OPTIONS,
	INVALID_INPUT_MODE,
	INVALID_USER_FIELD_NAME,
	INVALID_USER_FIELD_TYPE,
	parseFieldPayloadInput,
	pushUserFieldRecoverableError,
	validateCreateFieldPayload,
	validateUserFieldInputMode,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userFields', 'create');

const properties: INodeProperties[] = [
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
			'Choose how to define the user-field schema configuration payload (not user profile values)',
		hint: 'Using Fields Below is the standard path for common field-definition setup. Use Using JSON only when you need advanced payload control.',
	},
	{
		displayName:
			'Agent/Tool Setup mode keeps all create inputs visible and exposes Dropdown Options as a single field regardless of Type selection.',
		name: 'createUserFieldAgentToolModeNotice',
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
		required: true,
		description:
			'Display name for this user-field schema definition (maximum 30 characters). This names the field itself, not a value on a specific user profile.',
		displayOptions: {
			show: {
				inputMode: ['structured', 'agentTool'],
			},
		},
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		options: [
			{ name: 'Date Picker', value: 'date_picker' },
			{ name: 'Drop Down', value: 'drop_down' },
			{ name: 'Number', value: 'number' },
			{ name: 'Text Field', value: 'text_field' },
			{ name: 'URL', value: 'url' },
		],
		default: 'text_field',
		description:
			'Field type for this schema definition. Supported types: text_field, number, URL, date_picker, drop_down.',
		hint: 'For drop_down fields, provide plain option labels and Cliq assigns option IDs in the response.',
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
			'Whether this schema field is required across user profiles in the organization. When true, user profiles are expected to include this field.',
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
		description: 'Whether Cliq should mark values stored for this schema field as encrypted',
		hint: 'Use for sensitive profile fields. The node sends the encrypted flag but does not add local masking.',
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
		displayName: 'Dropdown Options',
		name: 'dropdownOptions',
		type: 'string',
		default: '',
		placeholder: 'e.g. Yes, No, Prefer not to say',
		description:
			'Comma-separated option labels for a drop_down schema field. Only used when Type is Drop Down.',
		hint: 'Provide plain labels only. Cliq assigns option IDs in the response.',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				type: ['drop_down'],
			},
		},
	},
	{
		displayName: 'Dropdown Options',
		name: 'agentToolDropdownOptions',
		type: 'string',
		default: '',
		placeholder: 'e.g. Yes, No, Prefer not to say',
		description:
			'Comma-separated option labels for a drop_down schema field. Only used when Type is Drop Down.',
		hint: 'Plain labels only. This field stays visible in Agent/Tool mode regardless of the Type selection.',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Field Definition (JSON)',
		name: 'fieldDefinitionRaw',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'JSON schema-definition payload for creating a user field. This is field configuration, not user profile data.',
		hint: 'Allowed keys: name, type, mandatory, encrypted, edit_permission, options.',
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
	},
	...getSimplifyParameters('userField', 'userField', 'create'),
	{
		displayName: `<a href="https://www.zoho.com/cliq/help/restapi/v2/#userfields-create" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> — Required scope: <code>${requiredScope}</code>. Creates a user-field schema definition, not a user profile record. In recoverable mode, the node preflights the 10-custom-field limit before sending the create call.`,
		name: 'createUserFieldDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User Field/Add User Field as AI Tool Setup Guide: <a href="${USER_FIELDS_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createUserFieldAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userField'],
		operation: ['create'],
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
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const inputMode = validateUserFieldInputMode(this, this.getNodeParameter('inputMode', i), i);
			let body: IDataObject;

			if (inputMode === 'structured' || inputMode === 'agentTool') {
				body = {
					name: this.getNodeParameter('name', i) as string,
					type: this.getNodeParameter('type', i) as string,
				};

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

				const dropdownOptionsParameterName =
					inputMode === 'agentTool' ? 'agentToolDropdownOptions' : 'dropdownOptions';
				const dropdownOptions = (
					this.getNodeParameter(dropdownOptionsParameterName, i, '') as string
				)
					.split(',')
					.map((option) => option.trim())
					.filter((option) => option.length > 0);
				if (dropdownOptions.length > 0) {
					body.options = dropdownOptions;
				}
			} else {
				const fieldDefinitionRaw = this.getNodeParameter('fieldDefinitionRaw', i, {}) as unknown;
				body = parseFieldPayloadInput(this, fieldDefinitionRaw, i, 'Field Definition');
			}

			body = validateCreateFieldPayload(this, body, i, 'Field Definition');
			try {
				await runUserFieldCreateLimitPreflight(this, i, grantedScopes);
			} catch (error) {
				// This preflight is advisory for stable hard-cap guidance. Transient list failures
				// should not block an otherwise valid create request.
				if (
					error instanceof Error &&
					(error as Error & { code?: string }).code === USER_FIELD_CUSTOM_LIMIT_REACHED_ERROR_CODE
				) {
					throw error;
				}
			}
			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/userfields', body);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('userField');
			const json = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
				'data',
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushUserFieldRecoverableError(this, returnData, i, 'create', error, {
					messageMappings: [
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code ===
									USER_FIELD_CUSTOM_LIMIT_REACHED_ERROR_CODE,
							reason: USER_FIELD_CUSTOM_LIMIT_REACHED_ERROR_CODE,
							messageOverride: USER_FIELD_CUSTOM_LIMIT_REACHED_MESSAGE,
							hint: USER_FIELD_CUSTOM_LIMIT_REACHED_HINT,
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
								(mappedError as Error & { code?: string }).code === INVALID_USER_FIELD_TYPE,
							reason: INVALID_USER_FIELD_TYPE,
							messageOverride:
								'Invalid type. Use one of: text_field, number, url, date_picker, drop_down.',
							hint: 'Use one of the supported create types: text_field, number, url, date_picker, drop_down.',
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === DROPDOWN_OPTIONS_REQUIRED,
							reason: DROPDOWN_OPTIONS_REQUIRED,
							hint: 'Provide one or more dropdown option labels when type is drop_down.',
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === DROPDOWN_OPTIONS_NOT_ALLOWED,
							reason: DROPDOWN_OPTIONS_NOT_ALLOWED,
							hint: 'Only provide dropdown options when type is drop_down.',
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === EMPTY_DROPDOWN_OPTIONS,
							reason: EMPTY_DROPDOWN_OPTIONS,
							hint: 'Provide at least one dropdown option label before retrying.',
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
