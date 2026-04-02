import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	isReactionAiErrorModeEnabled,
	normalizeReactionErrorForOutput,
	pushReactionRecoverableError,
	resolveReactionEnhancedOutput,
} from '../../../../../../nodes/ZohoCliq/v1/actions/reaction/common';
import { createReactionTestContext } from './testUtils';

describe('ZohoCliq - Reaction common helpers', () => {
	it('should read AI Error Mode from direct parameter values', () => {
		const context = createReactionTestContext({
			enableAiErrorMode: ' yes ',
		});

		expect(isReactionAiErrorModeEnabled(context, 0)).toBe(true);
	});

	it('should return false when enableAiErrorMode lookup throws and getNode is unavailable', () => {
		const context = {
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup failed');
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		expect(isReactionAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should fall back to node parameters for AI Error Mode', () => {
		const context = createReactionTestContext(
			{},
			{
				nodeParameters: {
					enableAiErrorMode: 'on',
				},
			},
		);

		expect(isReactionAiErrorModeEnabled(context, 0)).toBe(true);
	});

	it('should return false when node parameters are not a plain object', () => {
		const context = createReactionTestContext(
			{},
			{
				nodeParameters: [] as unknown as Record<string, unknown>,
			},
		);

		expect(isReactionAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when getNode throws during AI Error Mode fallback', () => {
		const context = createReactionTestContext();
		(context.getNode as jest.Mock).mockImplementation(() => {
			throw new Error('node lookup failed');
		});

		expect(isReactionAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when getNode returns undefined during AI Error Mode fallback', () => {
		const context = createReactionTestContext();
		(context.getNode as jest.Mock).mockReturnValue(undefined);

		expect(isReactionAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when recoverable mode is disabled', () => {
		const context = createReactionTestContext();
		const returnData: INodeExecutionData[] = [];

		const handled = pushReactionRecoverableError(
			context,
			returnData,
			0,
			'add',
			new Error('plain failure'),
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should return primitive errors unchanged when normalizing output errors', () => {
		const context = createReactionTestContext();

		const normalized = normalizeReactionErrorForOutput(context, 0, 'get', 'plain failure', {
			contextFields: {
				chat_id: 'CT_123_456',
			},
			messageMappings: [
				{
					match: (normalizedMessage) => normalizedMessage.includes('plain failure'),
					reason: 'INVALID_MESSAGE_TARGET',
					hint: 'Verify chat_id and message_id together.',
				},
			],
		});

		expect(normalized).toBe('plain failure');
	});

	it('should return undefined errors unchanged when normalizing output errors', () => {
		const context = createReactionTestContext();

		const normalized = normalizeReactionErrorForOutput(context, 0, 'get', undefined, {
			fallbackMessage: 'Unknown reaction failure',
		});

		expect(normalized).toBeUndefined();
	});

	it('should preserve scope-payload errors unchanged when normalizing output errors', () => {
		const context = createReactionTestContext();
		const error = {
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'reaction',
				operation: 'add',
			},
			message: 'scope failure',
		};

		const normalized = normalizeReactionErrorForOutput(context, 0, 'add', error);

		expect(normalized).toBe(error);
		expect(error).toEqual({
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'reaction',
				operation: 'add',
			},
			message: 'scope failure',
		});
	});

	it('should not treat array scope payloads as passthrough scope errors during normalization', () => {
		const context = createReactionTestContext();
		const error = {
			message: 'fallback after malformed scope payload',
			zohoCliqScopeErrorPayload: [],
		};

		const normalized = normalizeReactionErrorForOutput(context, 3, 'get', error, {
			messageMappings: [
				{
					match: (normalizedMessage) =>
						normalizedMessage.includes('fallback after malformed scope payload'),
					reason: 'INVALID_MESSAGE_TARGET',
					hint: 'Verify chat_id and message_id together.',
					messageOverride: 'Normalized malformed scope payload error.',
				},
			],
		});

		expect(normalized).toBe(error);
		expect(error).toEqual(
			expect.objectContaining({
				message: 'Normalized malformed scope payload error.',
				reason: 'INVALID_MESSAGE_TARGET',
				hint: 'Verify chat_id and message_id together.',
				description: 'Verify chat_id and message_id together.',
				itemIndex: 3,
				zohoCliqScopeErrorPayload: [],
			}),
		);
	});

	it('should not treat non-object scope payloads as passthrough scope errors during normalization', () => {
		const context = createReactionTestContext();
		const error = {
			message: 'string scope payload fallback',
			zohoCliqScopeErrorPayload: 'not-an-object',
		};

		const normalized = normalizeReactionErrorForOutput(context, 4, 'get', error, {
			messageMappings: [
				{
					match: (normalizedMessage) => normalizedMessage.includes('string scope payload fallback'),
					reason: 'INVALID_MESSAGE_TARGET',
					hint: 'Verify chat_id and message_id together.',
					messageOverride: 'Normalized string scope payload error.',
				},
			],
		});

		expect(normalized).toBe(error);
		expect(error).toEqual(
			expect.objectContaining({
				message: 'Normalized string scope payload error.',
				reason: 'INVALID_MESSAGE_TARGET',
				hint: 'Verify chat_id and message_id together.',
				itemIndex: 4,
				zohoCliqScopeErrorPayload: 'not-an-object',
			}),
		);
	});

	it('should enrich object errors and preserve an existing itemIndex when normalizing output errors', () => {
		const context = createReactionTestContext();
		const error = {
			message: 'Request URL is invalid',
			itemIndex: 99,
			description: 'existing description',
			response: {
				status: 404,
				data: {
					message: 'Request URL is invalid',
				},
			},
		};

		const normalized = normalizeReactionErrorForOutput(context, 0, 'get', error, {
			contextFields: {
				chat_id: 'CT_123_456',
				message_id: 'MSG_789',
			},
			messageMappings: [
				{
					match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
					reason: 'INVALID_MESSAGE_TARGET',
					hint: 'Verify chat_id and message_id together.',
					messageOverride: 'Unable to resolve the supplied reaction target.',
				},
			],
		});

		expect(normalized).toBe(error);
		expect(error).toEqual(
			expect.objectContaining({
				message: 'Unable to resolve the supplied reaction target.',
				reason: 'INVALID_MESSAGE_TARGET',
				hint: 'Verify chat_id and message_id together.',
				description: 'existing description',
				details: expect.objectContaining({
					statusCode: 404,
				}),
				status_code: 404,
				status_class: '4xx',
				itemIndex: 99,
			}),
		);
	});

	it('should leave message, reason, and hint untouched when normalization produces blank values', () => {
		const context = createReactionTestContext();
		const error: Record<string, unknown> = {};

		const normalized = normalizeReactionErrorForOutput(context, 7, 'remove', error, {
			fallbackMessage: '   ',
		});

		expect(normalized).toBe(error);
		expect(error).toEqual({
			itemIndex: 7,
		});
	});

	it('should build a generic recoverable payload when no scope payload is present', () => {
		const context = createReactionTestContext(
			{},
			{
				continueOnFail: true,
			},
		);
		const returnData: INodeExecutionData[] = [];

		const handled = pushReactionRecoverableError(
			context,
			returnData,
			0,
			'remove',
			{
				message: 'Reaction target is missing',
				response: {
					status: 404,
					data: {
						message: 'Reaction target is missing',
					},
				},
			},
			{
				contextFields: {
					chat_id: 'CT_123_456',
					message_id: 'MSG_789',
				},
				fallbackMessage: 'Fallback reaction error',
			},
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'reaction',
					operation: 'remove',
					message: 'Reaction target is missing',
					chat_id: 'CT_123_456',
					message_id: 'MSG_789',
					status_code: 404,
				}),
			},
		]);
	});

	it('should preserve scope payloads before generic recoverable fallback', () => {
		const context = createReactionTestContext(
			{},
			{
				continueOnFail: true,
			},
		);
		const returnData: INodeExecutionData[] = [];

		const handled = pushReactionRecoverableError(
			context,
			returnData,
			0,
			'get',
			{
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'reaction',
					operation: 'get',
					requiredScopes: ['ZohoCliq.messageactions.READ'],
				},
			},
			{
				contextFields: {
					chat_id: 'CT_123_456',
				},
			},
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					resource: 'reaction',
					operation: 'get',
					requiredScopes: ['ZohoCliq.messageactions.READ'],
					chat_id: 'CT_123_456',
				},
			},
		]);
	});

	it('should preserve scope payloads when no extra context fields are provided', () => {
		const context = createReactionTestContext(
			{},
			{
				continueOnFail: true,
			},
		);
		const returnData: INodeExecutionData[] = [];

		const handled = pushReactionRecoverableError(context, returnData, 0, 'add', {
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'reaction',
				operation: 'add',
			},
		});

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					resource: 'reaction',
					operation: 'add',
				},
			},
		]);
	});

	it('should ignore malformed scope payloads and use the generic recoverable builder', () => {
		const context = createReactionTestContext(
			{},
			{
				continueOnFail: true,
			},
		);
		const returnData: INodeExecutionData[] = [];

		const handled = pushReactionRecoverableError(context, returnData, 0, 'get', {
			zohoCliqScopeErrorPayload: [],
			message: 'Fallback after malformed scope payload',
		});

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'reaction',
					operation: 'get',
					message: 'Fallback after malformed scope payload',
				}),
			},
		]);
	});

	it('should handle undefined errors when building a recoverable payload', () => {
		const context = createReactionTestContext(
			{},
			{
				continueOnFail: true,
			},
		);
		const returnData: INodeExecutionData[] = [];

		const handled = pushReactionRecoverableError(context, returnData, 0, 'get', undefined, {
			fallbackMessage: 'Unknown reaction failure',
		});

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'reaction',
					operation: 'get',
					message: 'Unknown reaction failure',
				}),
			},
		]);
	});

	it('should coerce minimal responses for enhanced output', () => {
		const context = createReactionTestContext({
			includeEnhancedOutput: 'true',
		});

		expect(resolveReactionEnhancedOutput(context, 0, '')).toEqual({
			includeEnhancedOutput: true,
			rawResponse: {
				data: '',
			},
			responseJson: {
				data: '',
			},
		});
	});
});
