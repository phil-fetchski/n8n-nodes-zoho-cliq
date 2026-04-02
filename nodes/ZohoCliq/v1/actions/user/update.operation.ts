/**
 * Update User operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { USER_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import {
	getConditionalScopeRequirement,
	getRequiredScopeForOperation,
} from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	normalizeNameCase,
	validateEmail,
	validateTimezone,
	validateUserId,
} from '../../helpers/utils';
import {
	runDepartmentLookupPreflightGate,
	runDesignationLookupPreflightGate,
	runDirectUserLookupPreflightGate,
	USER_LOOKUP_NOT_FOUND_HINT,
} from '../shared/preflight';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import {
	appendWarningsToResponse,
	ensureSafeUserObject,
	getUserCustomFieldRecoverableMessageMappings,
	getUserEmailRecoverableMessageMappings,
	getUserIdentifierRecoverableMessageMappings,
	pushUserRecoverableError,
	RESERVED_USER_PAYLOAD_FIELDS,
	sanitizeImageDataBase64,
	sanitizeOptionalString,
	sanitizeStrictId,
	shouldRunUserRecoverablePreflight,
	USER_IANA_TIMEZONE_NOTICE,
	userIdLocator,
	validateUserInputMode,
	validateCustomFieldKey,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('user', 'update');
const updateUserInputModes = ['structured', 'agentTool', 'raw'] as const;
type UpdateUserInputMode = (typeof updateUserInputModes)[number];
const UPDATE_DEPARTMENT_HINT = 'Use List Departments to retrieve a valid department_id.';
const UPDATE_DESIGNATION_HINT = 'Use List Designations to retrieve a valid designation_id.';
const UPDATE_REPORTING_TO_HINT =
	"Use List_users_in_Zoho_Cliq or Get_a_user_in_Zoho_Cliq to verify the manager's ZUID before setting reporting_to_zuid.";
const updateUserIdLocator: INodeProperties = {
	...userIdLocator,
	description:
		'The user ID of the user to update. Unlike other User tools that may accept email or ZUID identifiers, Update User requires user ID only.',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchUsers',
				searchable: true,
			},
		},
		{
			displayName: 'By User ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 631830849',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-zA-Z0-9._-]+$',
						errorMessage:
							'User ID can only contain letters, numbers, periods, underscores, and hyphens',
					},
				},
			],
		},
	],
};

function validateUpdateTargetUserId(
	context: IExecuteFunctions,
	userId: string,
	itemIndex: number,
): string {
	const sanitizedUserId = validateUserId(context, userId, itemIndex);
	if (sanitizedUserId.includes('@')) {
		throw new NodeOperationError(
			context.getNode(),
			'Update User requires a Zoho Cliq user ID in the request URL. Email addresses are not supported here.',
			{ itemIndex },
		);
	}

	return sanitizedUserId;
}

function validateNumericUserReferenceId(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	config: {
		apiField: 'department_id' | 'designation_id';
		displayLabel: 'Department ID' | 'Designation ID';
		errorCode: 'INVALID_DEPARTMENT_ID' | 'INVALID_DESIGNATION_ID';
		hint: string;
	},
): string | undefined {
	const sanitizedValue = sanitizeOptionalString(
		context,
		value,
		config.displayLabel,
		itemIndex,
		200,
	);
	if (!sanitizedValue) {
		return undefined;
	}

	if (!/^\d+$/.test(sanitizedValue)) {
		const validationError = new NodeOperationError(
			context.getNode(),
			`${config.apiField} must be a numeric string.`,
			{
				itemIndex,
				description: config.hint,
			},
		);
		(validationError as NodeOperationError & { code?: string }).code = config.errorCode;
		throw validationError;
	}

	return sanitizedValue;
}

const properties: INodeProperties[] = [
	{
		...updateUserIdLocator,
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
			'Agent/Tool Setup Mode: All Update User inputs are shown at once so an AI agent can fill a single flattened update form without depending on the structured toggle groups.',
		name: 'updateUserAgentToolModeNotice',
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
		default: '',
		description: 'Updated email address. Leave blank to keep the current email address unchanged.',
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
		description: 'Updated first name. Leave blank to keep the current value unchanged.',
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
		description: 'Updated last name. Leave blank to keep the current value unchanged.',
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
		description: 'Updated employee ID. Leave blank to keep the current value unchanged.',
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
		description:
			'Updated Cliq nickname or display name. Leave blank to keep the current value unchanged.',
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
		description: 'Updated mobile number. Leave blank to keep the current value unchanged.',
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
		description: 'Updated phone number. Leave blank to keep the current value unchanged.',
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
		description: 'Updated desk phone extension. Leave blank to keep the current value unchanged.',
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
			'Image Data Guidance: Must be Base64 encoded. For Base64 conversion, use n8n\'s built-in Extract from File node with operation "Move File to Base64 String". You can fetch files/images from many service or cloud-storage nodes as input. For self-hosted n8n only, you can also use Read/Write Files from Disk to read local files from permissioned directories, then pass binary to Extract from File for Base64 conversion.',
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
		displayName: 'Department ID',
		name: 'agentToolDepartmentId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 5452022000000011111',
		description: 'Department ID. Leave blank to keep the current value unchanged.',
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
		description: 'Designation ID. Leave blank to keep the current value unchanged.',
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
		description: 'Updated manager ZUID. Leave blank to keep the current value unchanged.',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName:
			'Membership Note: Update User does not currently send channel IDs or team IDs. Use Channel or Team resource operations to manage memberships.',
		name: 'agentToolMembershipNotice',
		type: 'notice',
		default: '',
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
		description:
			'ISO 3166-1 alpha-2 country code. Leave blank to keep the current value unchanged.',
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
		description:
			'ISO 639-1 two-letter language code. Leave blank to keep the current value unchanged.',
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
		description: 'IANA timezone identifier. Leave blank to keep the current value unchanged.',
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
		description: 'Updated work location. Leave blank to keep the current value unchanged.',
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
		description: 'Custom user fields object keyed by unique name',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
	{
		displayName: 'First Name',
		name: 'firstName',
		type: 'string',
		default: '',
		description: 'Updated first name',
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
		description: 'Updated last name',
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
		displayName: 'Email ID',
		name: 'emailId',
		type: 'string',
		default: '',
		description:
			'Updated email address. Note: Some Zoho account types (for example Zoho One-managed accounts) may not allow changing email at the Cliq level.',
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
		description: 'Updated employee ID (organization-specific)',
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
		description: 'Mobile number',
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
		description: 'Phone number',
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
		description: 'Desk phone extension',
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
			'Image Data Guidance: Must be Base64 encoded. For Base64 conversion, use n8n\'s built-in Extract from File node with operation "Move File to Base64 String". You can fetch files/images from many service or cloud-storage nodes as input. For self-hosted n8n only, you can also use Read/Write Files from Disk to read local files from permissioned directories, then pass binary to Extract from File for Base64 conversion.',
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
		displayName:
			'Membership Note: Update User does not currently send channel/team IDs. Use Channel/Team resource operations to manage memberships.',
		name: 'membershipNotice',
		type: 'notice',
		default: '',
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
		description: 'Any work location text',
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
		displayName: 'Update Fields',
		name: 'updateFields',
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
		displayName: 'User Payload (JSON)',
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
			'Using JSON request body for the user object, for example: { "display_name": "Amy Smith" }',
	},
	...getSimplifyParameters('user', 'user', 'update'),
	{
		displayName: `Update User Details Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-user" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>; PROFILE PHOTO UPDATES ALSO REQUIRE: Profile.orguserphoto.UPDATE`,
		name: 'updateUserDocsNotice',
		type: 'notice',
		default: '',
		hint: 'Update User sends a single user object body, not a top-level `users` wrapper. In recoverable mode, this node can validate the target user before calling update when compatible lookup scopes are available. `channel_ids` and `team_ids` are ignored with warnings for compatibility; use Team or Channel operations for membership changes.',
	},
	{
		displayName:
			'To use Zoho Cliq User/Update User as an AI Tool, the developer suggests you switch `Input Mode` to `Agent/Tool Setup Fields` and follow the link to suggested tool descriptions.',
		name: 'updateUserAiToolModeSuggestionNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured', 'raw'],
			},
		},
	},
	{
		displayName: `Zoho Cliq User/Update User as AI Tool Setup Guide: <a href="${USER_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateUserAiToolGuideNotice',
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
		operation: ['update'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const imageUpdateScope =
		getConditionalScopeRequirement('user', 'update', 'imageDataProvided')?.requiredScopes[0] ??
		'Profile.orguserphoto.UPDATE';
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
		let customFieldKeysForErrorContext: string[] = [];
		let attemptedDepartmentIdForContext: string | undefined;
		let attemptedDesignationIdForContext: string | undefined;
		let attemptedEmailIdForContext: string | undefined;
		let attemptedReportingToZuidForContext: string | undefined;
		let attemptedUserIdForContext: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);
			const warnings: IDataObject[] = [];

			const userId = this.getNodeParameter('userId', i, '', { extractValue: true }) as string;
			const sanitizedUserId = validateUpdateTargetUserId(this, userId, i);
			attemptedUserIdForContext = sanitizedUserId;
			if (shouldRunUserRecoverablePreflight(this)) {
				await runDirectUserLookupPreflightGate(this, i, grantedScopes, sanitizedUserId, {
					subjectLabel: 'User',
					missing: {
						code: 'USER_NOT_FOUND',
						message: `No Zoho Cliq user found for User ID "${sanitizedUserId}". Verify the target user exists before retrying Update User.`,
						hint: USER_LOOKUP_NOT_FOUND_HINT,
					},
				});
			}
			const inputMode = validateUserInputMode(
				this,
				this.getNodeParameter('inputMode', i, 'structured'),
				i,
				updateUserInputModes,
			) as UpdateUserInputMode;

			let body: IDataObject;
			let includesImageData = false;

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
						`User Payload must be valid JSON${parseMessage}`,
						{
							itemIndex: i,
						},
					);
				}

				if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
					throw new NodeOperationError(this.getNode(), 'User Payload must be a JSON object', {
						itemIndex: i,
					});
				}

				ensureSafeUserObject(this, parsedPayload, i, 'usersPayload');
				const userRecord = parsedPayload as IDataObject;
				if (Object.prototype.hasOwnProperty.call(userRecord, 'users')) {
					throw new NodeOperationError(
						this.getNode(),
						'User Payload must be a single user object (not wrapped in "users")',
						{ itemIndex: i },
					);
				}

				if (Object.prototype.hasOwnProperty.call(userRecord, 'email_id')) {
					const trimmedEmail = String(userRecord.email_id).trim();
					attemptedEmailIdForContext = trimmedEmail || undefined;
					userRecord.email_id = validateEmail(this, trimmedEmail, i);
					attemptedEmailIdForContext = String(userRecord.email_id);
				}

				if (Object.prototype.hasOwnProperty.call(userRecord, 'department_id')) {
					const rawDepartmentId = String(userRecord.department_id ?? '').trim();
					attemptedDepartmentIdForContext = rawDepartmentId || undefined;
					const departmentId = validateNumericUserReferenceId(this, userRecord.department_id, i, {
						apiField: 'department_id',
						displayLabel: 'Department ID',
						errorCode: 'INVALID_DEPARTMENT_ID',
						hint: UPDATE_DEPARTMENT_HINT,
					});
					if (departmentId) {
						await runDepartmentLookupPreflightGate(this, i, grantedScopes, departmentId, {
							fieldLabel: 'department_id',
							missing: {
								code: 'DEPARTMENT_NOT_FOUND',
								message: `No department exists with ID "${departmentId}".`,
								hint: UPDATE_DEPARTMENT_HINT,
							},
						});
						userRecord.department_id = departmentId;
					} else {
						delete userRecord.department_id;
					}
				}

				if (Object.prototype.hasOwnProperty.call(userRecord, 'designation_id')) {
					const rawDesignationId = String(userRecord.designation_id ?? '').trim();
					attemptedDesignationIdForContext = rawDesignationId || undefined;
					const designationId = validateNumericUserReferenceId(this, userRecord.designation_id, i, {
						apiField: 'designation_id',
						displayLabel: 'Designation ID',
						errorCode: 'INVALID_DESIGNATION_ID',
						hint: UPDATE_DESIGNATION_HINT,
					});
					if (designationId) {
						await runDesignationLookupPreflightGate(this, i, grantedScopes, designationId, {
							fieldLabel: 'designation_id',
							missing: {
								code: 'DESIGNATION_NOT_FOUND',
								message: `No designation exists with ID "${designationId}".`,
								hint: UPDATE_DESIGNATION_HINT,
							},
						});
						userRecord.designation_id = designationId;
					} else {
						delete userRecord.designation_id;
					}
				}

				if (Object.prototype.hasOwnProperty.call(userRecord, 'reporting_to_zuid')) {
					const rawReportingToZuid = String(userRecord.reporting_to_zuid ?? '').trim();
					attemptedReportingToZuidForContext = rawReportingToZuid || undefined;
					const reportingToZuid = sanitizeStrictId(
						this,
						userRecord.reporting_to_zuid,
						'Reporting To ZUID',
						i,
					);
					if (reportingToZuid) {
						await runDirectUserLookupPreflightGate(this, i, grantedScopes, reportingToZuid, {
							subjectLabel: 'reporting_to_zuid',
							missing: {
								code: 'INVALID_REPORTING_TO',
								message: `No user exists with ZUID "${reportingToZuid}".`,
								hint: UPDATE_REPORTING_TO_HINT,
							},
						});
						userRecord.reporting_to_zuid = reportingToZuid;
					} else {
						delete userRecord.reporting_to_zuid;
					}
				}

				if (Object.prototype.hasOwnProperty.call(userRecord, 'image_data')) {
					try {
						const sanitizedImageData = sanitizeImageDataBase64(this, userRecord.image_data, i);
						if (sanitizedImageData) {
							userRecord.image_data = sanitizedImageData;
							includesImageData = true;
						} else {
							delete userRecord.image_data;
						}
					} catch (error) {
						delete userRecord.image_data;
						warnings.push({
							field: 'image_data',
							reason:
								error instanceof Error
									? `Removed image_data because validation failed: ${error.message}`
									: 'Removed image_data because validation failed.',
							action: 'Provide valid Base64 image content or omit image_data.',
						});
					}
				}

				if (Object.prototype.hasOwnProperty.call(userRecord, 'channel_ids')) {
					delete userRecord.channel_ids;
				}

				if (Object.prototype.hasOwnProperty.call(userRecord, 'team_ids')) {
					delete userRecord.team_ids;
				}

				if (Object.keys(userRecord).length === 0) {
					throw new NodeOperationError(this.getNode(), 'At least one update field is required', {
						itemIndex: i,
					});
				}

				body = userRecord;
			} else {
				let updateFields: IDataObject;
				let customFields: IDataObject = {};

				if (inputMode === 'agentTool') {
					updateFields = {
						emailId: (this.getNodeParameter('agentToolEmailId', i, '') as unknown) ?? '',
						firstName: (this.getNodeParameter('agentToolFirstName', i, '') as unknown) ?? '',
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
						departmentId: (this.getNodeParameter('agentToolDepartmentId', i, '') as unknown) ?? '',
						designationId:
							(this.getNodeParameter('agentToolDesignationId', i, '') as unknown) ?? '',
						reportingToZuid:
							(this.getNodeParameter('agentToolReportingToZuid', i, '') as unknown) ?? '',
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
					const legacyUpdateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
					const hasLegacyUpdateFields = Object.keys(legacyUpdateFields).length > 0;
					const addProfileDetails = hasLegacyUpdateFields
						? true
						: (this.getNodeParameter('addProfileDetails', i, false) as boolean);
					const addOrganizationDetails = hasLegacyUpdateFields
						? true
						: (this.getNodeParameter('addOrganizationDetails', i, false) as boolean);
					const addLocationDetails = hasLegacyUpdateFields
						? true
						: (this.getNodeParameter('addLocationDetails', i, false) as boolean);
					const addCustomFields = hasLegacyUpdateFields
						? true
						: (this.getNodeParameter('addCustomFields', i, false) as boolean);
					updateFields = hasLegacyUpdateFields
						? legacyUpdateFields
						: {
								firstName: (this.getNodeParameter('firstName', i, '') as unknown) ?? '',
								lastName: (this.getNodeParameter('lastName', i, '') as unknown) ?? '',
								normalizeNameCasing:
									(this.getNodeParameter('normalizeNameCasing', i, false) as unknown) ?? false,
								emailId: (this.getNodeParameter('emailId', i, '') as unknown) ?? '',
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
											departmentId: (this.getNodeParameter('departmentId', i, '') as unknown) ?? '',
											designationId:
												(this.getNodeParameter('designationId', i, '') as unknown) ?? '',
											reportingToZuid:
												(this.getNodeParameter('reportingToZuid', i, '') as unknown) ?? '',
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
				const normalizeNames = updateFields.normalizeNameCasing === true;

				const userPayload: IDataObject = {};

				const emailId = sanitizeOptionalString(this, updateFields.emailId, 'Email ID', i, 255);
				if (emailId) {
					attemptedEmailIdForContext = emailId;
					userPayload.email_id = validateEmail(this, emailId, i);
					attemptedEmailIdForContext = String(userPayload.email_id);
				}

				const firstName = sanitizeOptionalString(
					this,
					updateFields.firstName,
					'First Name',
					i,
					100,
				);
				if (firstName) {
					userPayload.first_name = normalizeNames ? normalizeNameCase(firstName) : firstName;
				}

				const lastName = sanitizeOptionalString(this, updateFields.lastName, 'Last Name', i, 100);
				if (lastName) {
					userPayload.last_name = normalizeNames ? normalizeNameCase(lastName) : lastName;
				}

				const displayName = sanitizeOptionalString(
					this,
					updateFields.displayName,
					'Display Name',
					i,
					120,
				);
				if (displayName) {
					userPayload.display_name = displayName;
				}

				const phone = sanitizeOptionalString(this, updateFields.phone, 'Phone', i, 50);
				if (phone) {
					userPayload.phone = phone;
				}

				const mobile = sanitizeOptionalString(this, updateFields.mobile, 'Mobile', i, 50);
				if (mobile) {
					userPayload.mobile = mobile;
				}

				if (updateFields.timezone) {
					userPayload.timezone = validateTimezone(this, String(updateFields.timezone), i);
				}

				const language = sanitizeOptionalString(this, updateFields.language, 'Language', i, 30);
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

				const country = sanitizeOptionalString(this, updateFields.country, 'Country', i, 100);
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

				attemptedDesignationIdForContext = sanitizeOptionalString(
					this,
					updateFields.designationId,
					'Designation ID',
					i,
					200,
				);
				const designationId = validateNumericUserReferenceId(this, updateFields.designationId, i, {
					apiField: 'designation_id',
					displayLabel: 'Designation ID',
					errorCode: 'INVALID_DESIGNATION_ID',
					hint: UPDATE_DESIGNATION_HINT,
				});
				if (designationId) {
					await runDesignationLookupPreflightGate(this, i, grantedScopes, designationId, {
						fieldLabel: 'designation_id',
						missing: {
							code: 'DESIGNATION_NOT_FOUND',
							message: `No designation exists with ID "${designationId}".`,
							hint: UPDATE_DESIGNATION_HINT,
						},
					});
					userPayload.designation_id = designationId;
				}

				attemptedDepartmentIdForContext = sanitizeOptionalString(
					this,
					updateFields.departmentId,
					'Department ID',
					i,
					200,
				);
				const departmentId = validateNumericUserReferenceId(this, updateFields.departmentId, i, {
					apiField: 'department_id',
					displayLabel: 'Department ID',
					errorCode: 'INVALID_DEPARTMENT_ID',
					hint: UPDATE_DEPARTMENT_HINT,
				});
				if (departmentId) {
					await runDepartmentLookupPreflightGate(this, i, grantedScopes, departmentId, {
						fieldLabel: 'department_id',
						missing: {
							code: 'DEPARTMENT_NOT_FOUND',
							message: `No department exists with ID "${departmentId}".`,
							hint: UPDATE_DEPARTMENT_HINT,
						},
					});
					userPayload.department_id = departmentId;
				}

				attemptedReportingToZuidForContext = sanitizeOptionalString(
					this,
					updateFields.reportingToZuid,
					'Reporting To ZUID',
					i,
					200,
				);
				const reportingToZuid = sanitizeStrictId(
					this,
					updateFields.reportingToZuid,
					'Reporting To ZUID',
					i,
				);
				if (reportingToZuid) {
					await runDirectUserLookupPreflightGate(this, i, grantedScopes, reportingToZuid, {
						subjectLabel: 'reporting_to_zuid',
						missing: {
							code: 'INVALID_REPORTING_TO',
							message: `No user exists with ZUID "${reportingToZuid}".`,
							hint: UPDATE_REPORTING_TO_HINT,
						},
					});
					userPayload.reporting_to_zuid = reportingToZuid;
				}

				const workLocation = sanitizeOptionalString(
					this,
					updateFields.workLocation,
					'Work Location',
					i,
					120,
				);
				if (workLocation) {
					userPayload.work_location = workLocation;
				}

				const extension = sanitizeOptionalString(this, updateFields.extension, 'Extension', i, 20);
				if (extension) {
					userPayload.extension = extension;
				}

				const employeeId = sanitizeOptionalString(
					this,
					updateFields.employeeId,
					'Employee ID',
					i,
					100,
				);
				if (employeeId) {
					userPayload.employee_id = employeeId;
				}

				if (
					Object.prototype.hasOwnProperty.call(updateFields, 'imageData') &&
					updateFields.imageData !== undefined
				) {
					try {
						const imageData = sanitizeImageDataBase64(this, updateFields.imageData, i);
						if (imageData) {
							includesImageData = true;
							userPayload.image_data = imageData;
						}
					} catch (error) {
						warnings.push({
							field: 'imageData',
							reason:
								error instanceof Error
									? `Removed image_data because validation failed: ${error.message}`
									: 'Removed image_data because validation failed.',
							action: 'Provide valid Base64 image content or leave Image Data blank.',
						});
					}
				}

				if (Object.prototype.hasOwnProperty.call(updateFields, 'channelIds')) {
					const value = String(updateFields.channelIds ?? '').trim();
					void value;
				}

				if (Object.prototype.hasOwnProperty.call(updateFields, 'teamIds')) {
					const value = String(updateFields.teamIds ?? '').trim();
					void value;
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
							`Custom field "${key}" conflicts with a reserved update field`,
							{ itemIndex: i },
						);
					}
					userPayload[key] = customFields[key];
				}

				if (Object.keys(userPayload).length === 0) {
					const imageWarning = warnings.find(
						(warning) => warning.field === 'imageData' && typeof warning.reason === 'string',
					);
					const message =
						typeof imageWarning?.reason === 'string'
							? `At least one update field is required. ${imageWarning.reason}`
							: 'At least one update field is required';
					throw new NodeOperationError(this.getNode(), message, { itemIndex: i });
				}

				body = userPayload;
			}

			if (includesImageData) {
				checkRequiredScope(this, grantedScopes, imageUpdateScope, i);
			}

			const endpoint = `/api/v2/users/${encodeURIComponent(sanitizedUserId)}`;
			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, body);
			const normalizedResponse = appendWarningsToResponse(response, warnings);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('user');
			const simplified = applySimplifyMode(
				coerceApiResponseToObject(normalizedResponse),
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
				pushUserRecoverableError(this, returnData, i, 'update', error, {
					contextFields: {
						...(attemptedUserIdForContext ? { user_id: attemptedUserIdForContext } : {}),
						...(attemptedEmailIdForContext ? { email_id: attemptedEmailIdForContext } : {}),
						...(attemptedDepartmentIdForContext
							? { department_id: attemptedDepartmentIdForContext }
							: {}),
						...(attemptedDesignationIdForContext
							? { designation_id: attemptedDesignationIdForContext }
							: {}),
						...(attemptedReportingToZuidForContext
							? { reporting_to_zuid: attemptedReportingToZuidForContext }
							: {}),
					},
					messageMappings: [
						...getUserEmailRecoverableMessageMappings(),
						...getUserCustomFieldRecoverableMessageMappings(customFieldKeysForErrorContext),
						...getUserIdentifierRecoverableMessageMappings(),
						{
							match: (_normalizedMessage, _message, caughtError) =>
								caughtError instanceof NodeOperationError &&
								(caughtError as NodeOperationError & { code?: string }).code ===
									'INVALID_DEPARTMENT_ID',
							reason: 'INVALID_DEPARTMENT_ID',
							hint: UPDATE_DEPARTMENT_HINT,
							payloadFields: () => ({
								field: 'department_id',
								value: attemptedDepartmentIdForContext,
							}),
						},
						{
							match: (_normalizedMessage, _message, caughtError) =>
								(caughtError instanceof NodeOperationError &&
									(caughtError as NodeOperationError & { code?: string }).code ===
										'DEPARTMENT_NOT_FOUND') ||
								(Boolean(attemptedDepartmentIdForContext) &&
									!attemptedDesignationIdForContext &&
									!attemptedReportingToZuidForContext &&
									(_normalizedMessage.includes(
										"couldn't process your request due to a technical error",
									) ||
										_normalizedMessage.includes('technical error'))),
							reason: 'DEPARTMENT_NOT_FOUND',
							messageOverride: () =>
								`No department exists with ID "${attemptedDepartmentIdForContext}".`,
							hint: UPDATE_DEPARTMENT_HINT,
							payloadFields: () => ({
								field: 'department_id',
								value: attemptedDepartmentIdForContext,
							}),
						},
						{
							match: (_normalizedMessage, _message, caughtError) =>
								caughtError instanceof NodeOperationError &&
								(caughtError as NodeOperationError & { code?: string }).code ===
									'INVALID_DESIGNATION_ID',
							reason: 'INVALID_DESIGNATION_ID',
							hint: UPDATE_DESIGNATION_HINT,
							payloadFields: () => ({
								field: 'designation_id',
								value: attemptedDesignationIdForContext,
							}),
						},
						{
							match: (_normalizedMessage, _message, caughtError) =>
								(caughtError instanceof NodeOperationError &&
									(caughtError as NodeOperationError & { code?: string }).code ===
										'DESIGNATION_NOT_FOUND') ||
								(Boolean(attemptedDesignationIdForContext) &&
									!attemptedDepartmentIdForContext &&
									!attemptedReportingToZuidForContext &&
									(_normalizedMessage.includes(
										"couldn't process your request due to a technical error",
									) ||
										_normalizedMessage.includes('technical error'))),
							reason: 'DESIGNATION_NOT_FOUND',
							messageOverride: () =>
								`No designation exists with ID "${attemptedDesignationIdForContext}".`,
							hint: UPDATE_DESIGNATION_HINT,
							payloadFields: () => ({
								field: 'designation_id',
								value: attemptedDesignationIdForContext,
							}),
						},
						{
							match: (_normalizedMessage, _message, caughtError) =>
								caughtError instanceof NodeOperationError &&
								(caughtError as NodeOperationError & { code?: string }).code ===
									'INVALID_REPORTING_TO',
							reason: 'INVALID_REPORTING_TO',
							hint: UPDATE_REPORTING_TO_HINT,
							payloadFields: () => ({
								field: 'reporting_to_zuid',
								value: attemptedReportingToZuidForContext,
							}),
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
