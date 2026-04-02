import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { router } from '../../../../../nodes/ZohoCliq/v1/actions/router';
import { validateCredentials } from '../../../../../nodes/ZohoCliq/v1/helpers/utils';
import * as bot from '../../../../../nodes/ZohoCliq/v1/actions/bot/Bot.resource';

jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils', () => ({
	validateCredentials: jest.fn(),
	parseBooleanLikeTrue: (value: unknown) => {
		if (value === true) return true;
		if (typeof value === 'number') return value === 1;
		if (typeof value === 'string') {
			return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
		}
		return false;
	},
}));

jest.mock('../../../../../nodes/ZohoCliq/v1/actions/bot/Bot.resource', () => ({
	getSubscribers: {
		execute: jest.fn(),
	},
	triggerCalls: {
		execute: jest.fn(),
	},
}));

describe('ZohoCliq Router - AI Error Mode', () => {
	const validateCredentialsMock = validateCredentials as jest.MockedFunction<
		typeof validateCredentials
	>;
	const getSubscribersExecuteMock = bot.getSubscribers.execute as jest.MockedFunction<
		typeof bot.getSubscribers.execute
	>;

	const createContext = (enableAiErrorMode: unknown, continueOnFailValue = false) => {
		const continueOnFail = jest.fn(() => continueOnFailValue);
		const getNodeParameter = jest.fn((name: string) => {
			if (name === 'resource') return 'bot';
			if (name === 'operation') return 'getSubscribers';
			if (name === 'enableAiErrorMode') return enableAiErrorMode;
			return undefined;
		});

		const context = {
			getInputData: jest.fn(() => [{ json: {} }] as INodeExecutionData[]),
			getNodeParameter,
			continueOnFail,
			getNode: jest.fn(() => ({ name: 'Zoho Cliq', type: 'n8n-nodes-zoho-cliq.zohoCliq' })),
		} as unknown as IExecuteFunctions & { continueOnFail: jest.Mock };

		return context;
	};

	beforeEach(() => {
		jest.clearAllMocks();
		validateCredentialsMock.mockResolvedValue('ZohoCliq.Bots.READ');
	});

	it('should throw when AI Error Mode is disabled and handler throws', async () => {
		const context = createContext(false);
		getSubscribersExecuteMock.mockRejectedValue(new Error('The bot could not be found'));

		await expect(router.call(context)).rejects.toThrow('The bot could not be found');
	});

	it('should force continue-on-fail behavior for handlers when AI Error Mode is enabled', async () => {
		const context = createContext(true);

		getSubscribersExecuteMock.mockImplementation(async function (this: IExecuteFunctions) {
			if (!this.continueOnFail()) {
				throw new Error('continueOnFail was not enabled');
			}

			return [
				{
					json: { success: false, message: "The bot you're looking for couldn't be found." },
					pairedItem: { item: 0 },
				},
			];
		});

		const result = await router.call(context);

		expect(result).toEqual([
			[
				{
					json: { success: false, message: "The bot you're looking for couldn't be found." },
					pairedItem: { item: 0 },
				},
			],
		]);
		expect(context.continueOnFail()).toBe(false);
	});

	it.each(['true', '1', 'yes', 'on', ' TRUE ', 'Yes'])(
		'should treat AI Error Mode value %p as enabled',
		async (enableAiErrorModeValue) => {
			const context = createContext(enableAiErrorModeValue);

			getSubscribersExecuteMock.mockImplementation(async function (this: IExecuteFunctions) {
				if (!this.continueOnFail()) {
					throw new Error('continueOnFail was not enabled');
				}

				return [
					{
						json: { success: false, message: 'string-ai-error-mode' },
						pairedItem: { item: 0 },
					},
				];
			});

			const result = await router.call(context);
			expect(result[0][0].json).toEqual(
				expect.objectContaining({ success: false, message: 'string-ai-error-mode' }),
			);
		},
	);

	it('should not override continueOnFail when it is already enabled', async () => {
		const context = createContext(true, true);
		const originalContinueOnFail = context.continueOnFail;

		getSubscribersExecuteMock.mockImplementation(async function (this: IExecuteFunctions) {
			return [
				{
					json: { continueOnFailValue: this.continueOnFail() },
					pairedItem: { item: 0 },
				},
			];
		});

		const result = await router.call(context);

		expect(result).toEqual([
			[
				{
					json: { continueOnFailValue: true },
					pairedItem: { item: 0 },
				},
			],
		]);
		expect(context.continueOnFail).toBe(originalContinueOnFail);
	});

	it('should restore continueOnFail after handler throws with AI Error Mode enabled', async () => {
		const context = createContext(true);

		getSubscribersExecuteMock.mockImplementation(async function (this: IExecuteFunctions) {
			if (!this.continueOnFail()) {
				throw new Error('continueOnFail was not enabled');
			}

			throw new Error('handler failure');
		});

		const result = await router.call(context);

		expect(result).toEqual([
			[
				{
					json: {
						error: 'handler failure',
						details: {},
					},
					pairedItem: { item: 0 },
				},
			],
		]);
		expect(context.continueOnFail()).toBe(false);
	});
});
