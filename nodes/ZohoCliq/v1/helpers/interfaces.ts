/**
 * API response interfaces from Zoho Cliq
 */

import type { IDataObject } from 'n8n-workflow';

/**
 * Type guard to check if a response is an error response
 */
export function isZohoCliqErrorResponse(response: unknown): response is IZohoCliqErrorResponse {
	return (
		typeof response === 'object' &&
		response !== null &&
		'error' in response &&
		typeof (response as IZohoCliqErrorResponse).error === 'string'
	);
}

/**
 * Type guard for channel list response
 */
export function isZohoCliqChannelListResponse(
	response: unknown,
): response is IZohoCliqChannelListResponse {
	return (
		typeof response === 'object' &&
		response !== null &&
		'channels' in response &&
		Array.isArray((response as IZohoCliqChannelListResponse).channels)
	);
}

/**
 * Error response interface
 */
export interface IZohoCliqErrorResponse extends IDataObject {
	code?: string;
	message: string;
	error?: string;
	error_code?: string;
	status?: string;
	details?: IDataObject;
}

/**
 * Channel interface for list responses
 */
export interface IZohoCliqChannelItem extends IDataObject {
	channel_id: string;
	name: string;
	unique_name?: string;
	description?: string;
	level?: 'organization' | 'team' | 'private' | 'external';
	status?: 'created' | 'archived' | 'pending';
	is_archived?: boolean;
	created_time?: number;
	modified_time?: number;
	members_count?: number;
	is_joined?: boolean;
	is_pinned?: boolean;
}

/**
 * Channel list response interface
 */
export interface IZohoCliqChannelListResponse extends IDataObject {
	channels?: IZohoCliqChannelItem[];
	has_more?: boolean;
	next_token?: string;
	sync_token?: string;
}
