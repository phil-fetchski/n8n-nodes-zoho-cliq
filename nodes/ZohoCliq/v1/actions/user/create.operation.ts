/**
 * Create User operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { USER_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	normalizeNameCase,
	validateEmail,
	validateTimezone,
} from '../../helpers/utils';
import {
	runChannelIdLookupPreflightGate,
	runDepartmentLookupPreflightGate,
	runDesignationLookupPreflightGate,
	runDirectUserLookupPreflightGate,
	runTeamLookupPreflightGate,
	USER_LOOKUP_NOT_FOUND_HINT,
} from '../shared/preflight';
import { zohoCliqApiRequest } from '../../transport';
import {
	appendWarningsToResponse,
	ensureSafeUserObject,
	getUserCustomFieldRecoverableMessageMappings,
	getUserEmailRecoverableMessageMappings,
	parseIdList,
	pushUserRecoverableError,
	RESERVED_USER_PAYLOAD_FIELDS,
	sanitizeImageDataBase64,
	sanitizeOptionalString,
	sanitizeStrictId,
	USER_IANA_TIMEZONE_NOTICE,
	validateUserInputMode,
	validateCustomFieldKey,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('user', 'create');
const createUserInputModes = ['structured', 'agentTool', 'raw'] as const;
type CreateUserInputMode = (typeof createUserInputModes)[number];

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function extractAlreadyAvailableUserEmails(response: IDataObject): string[] {
	const nestedData = asRecord(response.data);
	const candidate =
		nestedData !== undefined &&
		Object.prototype.hasOwnProperty.call(nestedData, 'already_availableusers')
			? nestedData.already_availableusers
			: response.already_availableusers;
	const resolvedEmails = new Set<string>();

	const appendEmail = (value: unknown) => {
		if (typeof value !== 'string') {
			return;
		}

		const trimmed = value.trim();
		if (trimmed) {
			resolvedEmails.add(trimmed);
		}
	};

	if (Array.isArray(candidate)) {
		for (const entry of candidate) {
			if (typeof entry === 'string') {
				appendEmail(entry);
				continue;
			}

			const record = asRecord(entry);
			if (!record) {
				continue;
			}

			appendEmail(record.email_id ?? record.email);
		}
	}

	if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
		for (const key of Object.keys(candidate)) {
			appendEmail(key);
		}
	}

	return Array.from(resolvedEmails);
}

const properties: INodeProperties[] = [
	{
		displayName:
			'Zoho One Guidance: If your organization is managed through Zoho One, add users in Zoho One first and assign Zoho Cliq access there. Creating users directly via Cliq API may produce users that are not fully provisioned in Zoho One-managed org directories.',
		name: 'createUserZohoOneNotice',
		type: 'notice',
		default: '',
	},
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
			'Choose whether to build the payload with individual fields or provide JSON directly',
	},
	{
		displayName:
			'Agent/Tool Setup Mode: All Create User inputs are shown at once so an AI agent can fill a single flattened user form without depending on the structured toggle groups.',
		name: 'createUserAgentToolModeNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Email ID',
		name: 'agentToolEmailId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. new.user@example.com',
		description: 'Email address for the new user',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'First Name',
		name: 'agentToolFirstName',
		type: 'string',
		default: '',
		description: 'First name of the user',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Last Name',
		name: 'agentToolLastName',
		type: 'string',
		default: '',
		description: 'Last name of the user',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Normalize Name Casing',
		name: 'agentToolNormalizeNameCasing',
		type: 'boolean',
		default: false,
		description:
			'Whether to normalize first and last names to first-letter uppercase and remaining lowercase',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Employee ID',
		name: 'agentToolEmployeeId',
		type: 'string',
		default: '',
		description: 'Employee ID of the user (organization-specific)',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Nickname',
		name: 'agentToolDisplayName',
		type: 'string',
		default: '',
		description: 'Nickname shown in Cliq',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Mobile',
		name: 'agentToolMobile',
		type: 'string',
		default: '',
		description: 'Mobile number of the user',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Phone',
		name: 'agentToolPhone',
		type: 'string',
		default: '',
		description: 'Phone number of the user',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Extension',
		name: 'agentToolExtension',
		type: 'string',
		default: '',
		description: 'Desk phone extension of the user',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Image Data',
		name: 'agentToolImageData',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 4,
		},
		description:
			'Optional base64-encoded profile image content. Provide Base64 from the original image file bytes, not a normal image URL or arbitrary Base64 text. Supported image formats include PNG, JPEG, GIF, WebP, AVIF, BMP, TIFF, ICO, and SVG. A data URL is accepted only when it contains base64 image data.',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName:
			'Image Data Guidance: Must be Base64 encoded image file content. For Base64 conversion, use n8n\'s built-in Extract from File node with operation "Move File to Base64 String". You can fetch files/images from many service or cloud-storage nodes as input. For self-hosted n8n only, you can also use Read/Write Files from Disk to read local files from permissioned directories, then pass binary to Extract from File for Base64 conversion.',
		name: 'agentToolImageDataNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Channel IDs',
		name: 'agentToolChannelIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. P5551011000000555001, P5552022000000555002',
		description: 'Comma-separated channel IDs to add the user to',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Department ID',
		name: 'agentToolDepartmentId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 5452022000000011111',
		description: 'Department ID. A user can be attached to only one department at a time.',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Designation ID',
		name: 'agentToolDesignationId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 5552022000005555055',
		description: 'Designation ID. A user can have only one designation at a time.',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Reporting To ZUID',
		name: 'agentToolReportingToZuid',
		type: 'string',
		default: '',
		placeholder: 'e.g. 987654321',
		description: 'Manager ZUID. A user can report to only one manager at a time.',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Team IDs',
		name: 'agentToolTeamIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. 876543210, 876543211',
		description: 'Comma-separated team IDs to add the user to',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Country (Alpha-2 Code)',
		name: 'agentToolCountry',
		type: 'string',
		default: '',
		placeholder: 'e.g. US',
		description: 'ISO 3166-1 alpha-2 country code',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName:
			'Country Code Help: Use alpha-2 codes only. Reference: <a href="https://www.iban.com/country-codes" target="_blank" rel="noopener noreferrer">Country Code List</a>',
		name: 'agentToolCountryCodeNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Language (Alpha-2 Code)',
		name: 'agentToolLanguage',
		type: 'string',
		default: '',
		placeholder: 'e.g. en',
		description: 'ISO 639-1 two-letter language code',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName:
			'Language Code Help: Use alpha-2 codes only. Reference: <a href="https://developers.google.com/workspace/admin/directory/v1/languages" target="_blank" rel="noopener noreferrer">Language Code List</a>',
		name: 'agentToolLanguageCodeNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Timezone',
		name: 'agentToolTimezone',
		type: 'string',
		default: '',
		placeholder: 'e.g. America/New_York',
		description: 'IANA timezone identifier',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: USER_IANA_TIMEZONE_NOTICE,
		name: 'agentToolTimezoneNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Work Location',
		name: 'agentToolWorkLocation',
		type: 'string',
		default: '',
		description: 'Work location for the user',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'Custom Fields',
		name: 'agentToolCustomFields',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
		description: 'Custom user fields object keyed by unique name',
	},
	{
		displayName: 'Email ID',
		name: 'emailId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. new.user@example.com',
		description: 'Email address for the new user',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		default: '',
		description: 'First name of the user',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Last Name',
		name: 'lastName',
		type: 'string',
		default: '',
		description: 'Last name of the user',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Normalize Name Casing',
		name: 'normalizeNameCasing',
		type: 'boolean',
		default: false,
		description:
			'Whether to normalize first and last names to first-letter uppercase and remaining lowercase',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Employee ID',
		name: 'employeeId',
		type: 'string',
		default: '',
		description: 'Employee ID of the user (organization-specific)',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Add Additional Profile Details',
		name: 'addProfileDetails',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Nickname',
		name: 'displayName',
		type: 'string',
		default: '',
		description: 'Nickname shown in Cliq',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addProfileDetails: [true],
			},
		},
	},
	{
		displayName: 'Mobile',
		name: 'mobile',
		type: 'string',
		default: '',
		description: 'Mobile number of the user',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addProfileDetails: [true],
			},
		},
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		description: 'Phone number of the user',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addProfileDetails: [true],
			},
		},
	},
	{
		displayName: 'Extension',
		name: 'extension',
		type: 'string',
		default: '',
		description: 'Desk phone extension of the user',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addProfileDetails: [true],
			},
		},
	},
	{
		displayName: 'Image Data',
		name: 'imageData',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 4,
		},
		description:
			'Optional base64-encoded profile image content. Provide Base64 from the original image file bytes, not a normal image URL or arbitrary Base64 text. Supported image formats include PNG, JPEG, GIF, WebP, AVIF, BMP, TIFF, ICO, and SVG. A data URL is accepted only when it contains base64 image data.',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addProfileDetails: [true],
			},
		},
	},
	{
		displayName:
			'Image Data Guidance: Must be Base64 encoded image file content. For Base64 conversion, use n8n\'s built-in Extract from File node with operation "Move File to Base64 String". You can fetch files/images from many service or cloud-storage nodes as input. For self-hosted n8n only, you can also use Read/Write Files from Disk to read local files from permissioned directories, then pass binary to Extract from File for Base64 conversion.',
		name: 'imageDataNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addProfileDetails: [true],
			},
		},
	},
	{
		displayName: 'Add Additional Organization Details',
		name: 'addOrganizationDetails',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Channel IDs',
		name: 'channelIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. P5551011000000555001, P5552022000000555002',
		description: 'Comma-separated channel IDs to add the user to',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addOrganizationDetails: [true],
			},
		},
	},
	{
		displayName: 'Department ID',
		name: 'departmentId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 5452022000000011111',
		description: 'Department ID. A user can be attached to only one department at a time.',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addOrganizationDetails: [true],
			},
		},
	},
	{
		displayName: 'Designation ID',
		name: 'designationId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 5552022000005555055',
		description: 'Designation ID. A user can have only one designation at a time.',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addOrganizationDetails: [true],
			},
		},
	},
	{
		displayName: 'Reporting To ZUID',
		name: 'reportingToZuid',
		type: 'string',
		default: '',
		placeholder: 'e.g. 987654321',
		description: 'Manager ZUID. A user can report to only one manager at a time.',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addOrganizationDetails: [true],
			},
		},
	},
	{
		displayName: 'Team IDs',
		name: 'teamIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. 876543210, 876543211',
		description: 'Comma-separated team IDs to add the user to',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addOrganizationDetails: [true],
			},
		},
	},
	{
		displayName: 'Add Location Details',
		name: 'addLocationDetails',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Country (Alpha-2 Code)',
		name: 'country',
		type: 'string',
		default: '',
		placeholder: 'e.g. US',
		description: 'ISO 3166-1 alpha-2 country code',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addLocationDetails: [true],
			},
		},
	},
	{
		displayName:
			'Country Code Help: Use alpha-2 codes only. Reference: <a href="https://www.iban.com/country-codes" target="_blank" rel="noopener noreferrer">Country Code List</a>',
		name: 'countryCodeNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addLocationDetails: [true],
			},
		},
	},
	{
		displayName: 'Language (Alpha-2 Code)',
		name: 'language',
		type: 'string',
		default: '',
		placeholder: 'e.g. en',
		description: 'ISO 639-1 two-letter language code',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addLocationDetails: [true],
			},
		},
	},
	{
		displayName:
			'Language Code Help: Use alpha-2 codes only. Reference: <a href="https://developers.google.com/workspace/admin/directory/v1/languages" target="_blank" rel="noopener noreferrer">Language Code List</a>',
		name: 'languageCodeNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addLocationDetails: [true],
			},
		},
	},
	{
		displayName: 'Timezone',
		name: 'timezone',
		type: 'string',
		default: '',
		placeholder: 'e.g. America/New_York',
		description: 'IANA timezone identifier',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addLocationDetails: [true],
			},
		},
	},
	{
		displayName: USER_IANA_TIMEZONE_NOTICE,
		name: 'timezoneNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addLocationDetails: [true],
			},
		},
	},
	{
		displayName: 'Work Location',
		name: 'workLocation',
		type: 'string',
		default: '',
		description: 'Work location for the user',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addLocationDetails: [true],
			},
		},
	},
	{
		displayName: 'Add Custom Fields',
		name: 'addCustomFields',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Legacy Additional Fields (Hidden)',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		displayOptions: {
			show: {
				resource: ['__legacy__'],
				inputMode: ['structured'],
			},
		},
		options: [],
	},
	{
		displayName: 'Custom Fields',
		name: 'customFields',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				addCustomFields: [true],
			},
		},
		description: 'Custom user fields object keyed by unique name',
	},
	{
		displayName: 'Users Payload (JSON)',
		name: 'usersPayload',
		type: 'json',
		required: true,
		default: '{}',
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON request body in the exact API format, for example: { "users": [ { "email_id": "user@example.com" } ] }',
	},
	{
		displayName: `Add a User Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#add-user" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createUserDocsNotice',
		type: 'notice',
		default: '',
		hint: 'Create User always sends a top-level `users` array wrapper. Agent/Tool Setup Fields mode builds that wrapper for you automatically. Using JSON mode must keep that wrapper, even when creating only one user.',
	},
	{
		displayName:
			'To use Zoho Cliq User/Create User as an AI Tool, the developer suggests you switch `Input Mode` to `Agent/Tool Setup Fields` and follow the link to suggested tool descriptions.',
		name: 'createUserAiToolModeSuggestionNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured', 'raw'],
			},
		},
	},
	{
		displayName: `Zoho Cliq User/Create User as AI Tool Setup Guide: <a href="${USER_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createUserAiToolGuideNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
];

const displayOptions = {
	show: {
		resource: ['user'],
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
	const parseCustomFieldsInput = (rawCustomFields: unknown, itemIndex: number): IDataObject => {
		let parsedCustomFields: unknown;
		try {
			if (typeof rawCustomFields === 'string' && rawCustomFields.trim() === '') {
				parsedCustomFields = {};
			} else {
				parsedCustomFields =
					typeof rawCustomFields === 'string'
						? (JSON.parse(rawCustomFields) as unknown)
						: rawCustomFields;
			}
		} catch {
			throw new NodeOperationError(this.getNode(), 'Custom Fields must be a valid JSON object', {
				itemIndex,
			});
		}

		if (
			!parsedCustomFields ||
			typeof parsedCustomFields !== 'object' ||
			Array.isArray(parsedCustomFields)
		) {
			throw new NodeOperationError(this.getNode(), 'Custom Fields must be a JSON object', {
				itemIndex,
			});
		}

		return parsedCustomFields as IDataObject;
	};

	for (let i = 0; i < items.length; i++) {
		let inputModeForContext: CreateUserInputMode | undefined;
		let attemptedEmailIdForContext: string | undefined;
		let customFieldKeysForErrorContext: string[] = [];
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);
			const warnings: IDataObject[] = [];

			const inputMode = validateUserInputMode(
				this,
				this.getNodeParameter('inputMode', i, 'structured'),
				i,
				createUserInputModes,
			) as CreateUserInputMode;
			inputModeForContext = inputMode;
			let body: IDataObject;

			if (inputMode === 'raw') {
				const rawUsersPayload = this.getNodeParameter('usersPayload', i, {}) as unknown;
				let parsedPayload: unknown;
				try {
					parsedPayload =
						typeof rawUsersPayload === 'string'
							? (JSON.parse(rawUsersPayload) as unknown)
							: rawUsersPayload;
				} catch (error) {
					const parseMessage = error instanceof Error ? `: ${error.message}` : '';
					throw new NodeOperationError(
						this.getNode(),
						`Users Payload must be valid JSON${parseMessage}`,
						{
							itemIndex: i,
						},
					);
				}

				if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
					throw new NodeOperationError(
						this.getNode(),
						'Users Payload must be a JSON object with a "users" array',
						{ itemIndex: i },
					);
				}

				ensureSafeUserObject(this, parsedPayload, i, 'usersPayload');

				const typedPayload = parsedPayload as IDataObject;
				if (!Array.isArray(typedPayload.users) || typedPayload.users.length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						'Users Payload must include a non-empty "users" array',
						{ itemIndex: i },
					);
				}

				for (let idx = 0; idx < typedPayload.users.length; idx++) {
					const entry = typedPayload.users[idx];
					if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
						throw new NodeOperationError(this.getNode(), `users[${idx}] must be an object`, {
							itemIndex: i,
						});
					}

					const typedEntry = entry as IDataObject;
					const emailId = String(typedEntry.email_id ?? '').trim();
					if (!emailId) {
						throw new NodeOperationError(this.getNode(), `users[${idx}].email_id is required`, {
							itemIndex: i,
						});
					}
					if (!attemptedEmailIdForContext) {
						attemptedEmailIdForContext = emailId;
					}
					typedEntry.email_id = validateEmail(this, emailId, i);

					if (Object.prototype.hasOwnProperty.call(typedEntry, 'image_data')) {
						const imageData = sanitizeImageDataBase64(
							this,
							typedEntry.image_data,
							i,
							`users[${idx}].image_data`,
						);
						if (imageData) {
							typedEntry.image_data = imageData;
						} else {
							delete typedEntry.image_data;
							warnings.push({
								field: `users[${idx}].image_data`,
								reason: `Removed users[${idx}].image_data because it was empty.`,
								action: 'Provide valid Base64 image content or omit image_data.',
							});
						}
					}
				}

				body = typedPayload;
			} else {
				let emailId: string;
				let firstName: string;
				let additionalFields: IDataObject;
				let customFields: IDataObject = {};

				if (inputMode === 'agentTool') {
					emailId = this.getNodeParameter('agentToolEmailId', i) as string;
					firstName = this.getNodeParameter('agentToolFirstName', i, '') as string;
					additionalFields = {
						lastName: (this.getNodeParameter('agentToolLastName', i, '') as unknown) ?? '',
						normalizeNameCasing:
							(this.getNodeParameter('agentToolNormalizeNameCasing', i, false) as unknown) ?? false,
						employeeId: (this.getNodeParameter('agentToolEmployeeId', i, '') as unknown) ?? '',
						displayName: (this.getNodeParameter('agentToolDisplayName', i, '') as unknown) ?? '',
						mobile: (this.getNodeParameter('agentToolMobile', i, '') as unknown) ?? '',
						phone: (this.getNodeParameter('agentToolPhone', i, '') as unknown) ?? '',
						extension: (this.getNodeParameter('agentToolExtension', i, '') as unknown) ?? '',
						imageData: this.getNodeParameter(
							'agentToolImageData',
							i,
							undefined as unknown as string,
						) as string | undefined,
						channelIds: (this.getNodeParameter('agentToolChannelIds', i, '') as unknown) ?? '',
						departmentId: (this.getNodeParameter('agentToolDepartmentId', i, '') as unknown) ?? '',
						designationId:
							(this.getNodeParameter('agentToolDesignationId', i, '') as unknown) ?? '',
						reportingToZuid:
							(this.getNodeParameter('agentToolReportingToZuid', i, '') as unknown) ?? '',
						teamIds: (this.getNodeParameter('agentToolTeamIds', i, '') as unknown) ?? '',
						country: (this.getNodeParameter('agentToolCountry', i, '') as unknown) ?? '',
						language: (this.getNodeParameter('agentToolLanguage', i, '') as unknown) ?? '',
						timezone: (this.getNodeParameter('agentToolTimezone', i, '') as unknown) ?? '',
						workLocation: (this.getNodeParameter('agentToolWorkLocation', i, '') as unknown) ?? '',
					};
					customFields = parseCustomFieldsInput(
						this.getNodeParameter('agentToolCustomFields', i, {}) as unknown,
						i,
					);
					customFieldKeysForErrorContext = Object.keys(customFields);
				} else {
					emailId = this.getNodeParameter('emailId', i) as string;
					firstName = this.getNodeParameter('firstName', i) as string;
					const legacyAdditionalFields = this.getNodeParameter(
						'additionalFields',
						i,
						{},
					) as IDataObject;
					const hasLegacyAdditionalFields = Object.keys(legacyAdditionalFields).length > 0;
					const addProfileDetails = hasLegacyAdditionalFields
						? true
						: (this.getNodeParameter('addProfileDetails', i, false) as boolean);
					const addOrganizationDetails = hasLegacyAdditionalFields
						? true
						: (this.getNodeParameter('addOrganizationDetails', i, false) as boolean);
					const addLocationDetails = hasLegacyAdditionalFields
						? true
						: (this.getNodeParameter('addLocationDetails', i, false) as boolean);
					const addCustomFields = hasLegacyAdditionalFields
						? true
						: (this.getNodeParameter('addCustomFields', i, false) as boolean);
					additionalFields = hasLegacyAdditionalFields
						? legacyAdditionalFields
						: {
								lastName: (this.getNodeParameter('lastName', i, '') as unknown) ?? '',
								normalizeNameCasing:
									(this.getNodeParameter('normalizeNameCasing', i, false) as unknown) ?? false,
								employeeId: (this.getNodeParameter('employeeId', i, '') as unknown) ?? '',
								...(addProfileDetails
									? {
											displayName: (this.getNodeParameter('displayName', i, '') as unknown) ?? '',
											mobile: (this.getNodeParameter('mobile', i, '') as unknown) ?? '',
											phone: (this.getNodeParameter('phone', i, '') as unknown) ?? '',
											extension: (this.getNodeParameter('extension', i, '') as unknown) ?? '',
											imageData: this.getNodeParameter(
												'imageData',
												i,
												undefined as unknown as string,
											) as string | undefined,
										}
									: {}),
								...(addOrganizationDetails
									? {
											channelIds: (this.getNodeParameter('channelIds', i, '') as unknown) ?? '',
											departmentId: (this.getNodeParameter('departmentId', i, '') as unknown) ?? '',
											designationId:
												(this.getNodeParameter('designationId', i, '') as unknown) ?? '',
											reportingToZuid:
												(this.getNodeParameter('reportingToZuid', i, '') as unknown) ?? '',
											teamIds: (this.getNodeParameter('teamIds', i, '') as unknown) ?? '',
										}
									: {}),
								...(addLocationDetails
									? {
											country: (this.getNodeParameter('country', i, '') as unknown) ?? '',
											language: (this.getNodeParameter('language', i, '') as unknown) ?? '',
											timezone: (this.getNodeParameter('timezone', i, '') as unknown) ?? '',
											workLocation: (this.getNodeParameter('workLocation', i, '') as unknown) ?? '',
										}
									: {}),
							};
					if (addCustomFields) {
						customFields = parseCustomFieldsInput(
							this.getNodeParameter('customFields', i, {}) as unknown,
							i,
						);
					}
					customFieldKeysForErrorContext = Object.keys(customFields);
				}

				const normalizeNames = additionalFields.normalizeNameCasing === true;

				attemptedEmailIdForContext = String(emailId).trim();
				const userPayload: IDataObject = {
					email_id: validateEmail(this, emailId, i),
				};
				attemptedEmailIdForContext = String(userPayload.email_id);

				const sanitizedFirstName = sanitizeOptionalString(this, firstName, 'First Name', i, 100);
				if (sanitizedFirstName) {
					userPayload.first_name = normalizeNames
						? normalizeNameCase(sanitizedFirstName)
						: sanitizedFirstName;
				}

				const sanitizedLastName = sanitizeOptionalString(
					this,
					additionalFields.lastName,
					'Last Name',
					i,
					100,
				);
				if (sanitizedLastName) {
					userPayload.last_name = normalizeNames
						? normalizeNameCase(sanitizedLastName)
						: sanitizedLastName;
				}

				const displayName = sanitizeOptionalString(
					this,
					additionalFields.displayName,
					'Display Name',
					i,
					120,
				);
				if (displayName) {
					userPayload.display_name = displayName;
				}

				const phone = sanitizeOptionalString(this, additionalFields.phone, 'Phone', i, 50);
				if (phone) {
					userPayload.phone = phone;
				}

				const mobile = sanitizeOptionalString(this, additionalFields.mobile, 'Mobile', i, 50);
				if (mobile) {
					userPayload.mobile = mobile;
				}

				if (additionalFields.timezone) {
					userPayload.timezone = validateTimezone(this, String(additionalFields.timezone), i);
				}

				const language = sanitizeOptionalString(this, additionalFields.language, 'Language', i, 30);
				if (language) {
					if (!/^[a-zA-Z]{2}$/.test(language)) {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid Language format. Use an ISO 639-1 alpha-2 code such as en.',
							{ itemIndex: i },
						);
					}
					userPayload.language = language.toLowerCase();
				}

				const country = sanitizeOptionalString(this, additionalFields.country, 'Country', i, 100);
				if (country) {
					if (!/^[a-zA-Z]{2}$/.test(country)) {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid Country format. Use an ISO 3166-1 alpha-2 code such as US.',
							{ itemIndex: i },
						);
					}
					userPayload.country = country.toUpperCase();
				}

				const departmentId = sanitizeStrictId(
					this,
					additionalFields.departmentId,
					'Department ID',
					i,
				);
				if (departmentId) {
					await runDepartmentLookupPreflightGate(this, i, grantedScopes, departmentId);
				}
				if (departmentId) {
					userPayload.department_id = departmentId;
				}

				const designationId = sanitizeStrictId(
					this,
					additionalFields.designationId,
					'Designation ID',
					i,
				);
				if (designationId) {
					await runDesignationLookupPreflightGate(this, i, grantedScopes, designationId);
				}
				if (designationId) {
					userPayload.designation_id = designationId;
				}

				const reportingToZuid = sanitizeStrictId(
					this,
					additionalFields.reportingToZuid,
					'Reporting To ZUID',
					i,
				);
				if (reportingToZuid) {
					await runDirectUserLookupPreflightGate(this, i, grantedScopes, reportingToZuid, {
						subjectLabel: 'Reporting To ZUID',
						missing: {
							code: 'USER_NOT_FOUND',
							message: `No Zoho Cliq user found for Reporting To ZUID "${reportingToZuid}". Verify the reporting user exists before retrying Add User.`,
							hint: USER_LOOKUP_NOT_FOUND_HINT,
						},
					});
				}
				if (reportingToZuid) {
					userPayload.reporting_to_zuid = reportingToZuid;
				}

				const workLocation = sanitizeOptionalString(
					this,
					additionalFields.workLocation,
					'Work Location',
					i,
					120,
				);
				if (workLocation) {
					userPayload.work_location = workLocation;
				}

				const extension = sanitizeOptionalString(
					this,
					additionalFields.extension,
					'Extension',
					i,
					20,
				);
				if (extension) {
					userPayload.extension = extension;
				}

				const employeeId = sanitizeOptionalString(
					this,
					additionalFields.employeeId,
					'Employee ID',
					i,
					100,
				);
				if (employeeId) {
					userPayload.employee_id = employeeId;
				}

				if (
					Object.prototype.hasOwnProperty.call(additionalFields, 'imageData') &&
					additionalFields.imageData !== undefined
				) {
					const imageData = sanitizeImageDataBase64(this, additionalFields.imageData, i);
					if (imageData) {
						userPayload.image_data = imageData;
					}
				}

				if (additionalFields.teamIds) {
					const teamIds = parseIdList(this, String(additionalFields.teamIds), 'team ID', i);
					if (teamIds.length) {
						for (const teamId of teamIds) {
							await runTeamLookupPreflightGate(this, i, grantedScopes, teamId);
						}
						userPayload.team_ids = teamIds;
					}
				}

				if (additionalFields.channelIds) {
					const channelIds = parseIdList(
						this,
						String(additionalFields.channelIds),
						'channel ID',
						i,
					);
					if (channelIds.length) {
						for (const channelId of channelIds) {
							await runChannelIdLookupPreflightGate(this, i, grantedScopes, channelId);
						}
						userPayload.channel_ids = channelIds;
					}
				}

				ensureSafeUserObject(this, customFields, i, 'customFields');
				for (const key of Object.keys(customFields)) {
					validateCustomFieldKey(this, key, i);
					if (
						RESERVED_USER_PAYLOAD_FIELDS.has(key) ||
						Object.prototype.hasOwnProperty.call(userPayload, key)
					) {
						throw new NodeOperationError(
							this.getNode(),
							`Custom field "${key}" conflicts with a reserved user field`,
							{ itemIndex: i },
						);
					}
					userPayload[key] = customFields[key];
				}

				body = {
					users: [userPayload],
				};
			}

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/users', body);
			const responseWithWarnings = appendWarningsToResponse(response, warnings);
			const alreadyAvailableUserEmails = extractAlreadyAvailableUserEmails(responseWithWarnings);
			if (alreadyAvailableUserEmails.length > 0) {
				const duplicateEmail = alreadyAvailableUserEmails[0];
				attemptedEmailIdForContext = duplicateEmail;

				const duplicateError = new NodeOperationError(
					this.getNode(),
					`A user with email "${duplicateEmail}" already exists in this organization.`,
					{
						itemIndex: i,
						description:
							"Use Get_a_user_in_Zoho_Cliq with the email address to retrieve the existing user's profile.",
					},
				);
				(duplicateError as NodeOperationError & { code?: string }).code = 'USER_ALREADY_EXISTS';
				throw duplicateError;
			}

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: responseWithWarnings }],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushUserRecoverableError(this, returnData, i, 'create', error, {
					contextFields: {
						...(attemptedEmailIdForContext ? { email_id: attemptedEmailIdForContext } : {}),
						...(inputModeForContext ? { input_mode: inputModeForContext } : {}),
					},
					messageMappings: [
						...getUserEmailRecoverableMessageMappings(),
						...getUserCustomFieldRecoverableMessageMappings(customFieldKeysForErrorContext),
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
