/**
 * Get Event Calendars operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { EVENTS_GET_CALENDARS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { pushEventsRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('events', 'getCalendars');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

const properties: INodeProperties[] = [
	{
		displayName: 'Include Hidden Calendars',
		name: 'includeHiddenCalendars',
		type: 'boolean',
		default: false,
		description: 'Whether to include hidden calendars in the response',
	},
	...getSimplifyParameters('eventCalendar', 'event', 'getCalendars'),
	{
		displayName: `Get Event Calendars Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#event-calendars" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'getEventCalendarsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Events/Get Event Calendars as AI Tool Setup Guide: <a href="${EVENTS_GET_CALENDARS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getEventCalendarsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['event'],
		operation: ['getCalendars'],
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
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			const includeHiddenCalendars = this.getNodeParameter(
				'includeHiddenCalendars',
				i,
				false,
			) as boolean;

			const response = await zohoCliqApiRequest.call(
				this,
				'GET',
				'/api/v2/calendars',
				undefined,
				includeHiddenCalendars ? { include_hidden_calendars: true } : undefined,
			);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('eventCalendar');
			const listItems = applySimplifyModeToList(
				coerceApiResponseToObject(response),
				'data',
				mode,
				config,
				selectedFields,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushEventsRecoverableError(this, returnData, i, 'getCalendars', error, {
					contextFields: {
						include_hidden_calendars: Boolean(
							this.getNodeParameter('includeHiddenCalendars', i, false),
						),
					},
				})
			) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
