import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as triggerCalls from '../../../../../../nodes/ZohoCliq/v1/actions/bot/triggerCalls.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Bot - Trigger Calls Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should trigger bot calls successfully in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('123,456')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(2)
			.mockReturnValueOnce({
				action: [
					{
						label: 'View details',
						actionType: 'open.url',
						openUrl: 'https://cliq.zoho.com',
					},
				],
			})
			.mockReturnValueOnce(true)
			.mockReturnValueOnce('abc123');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/calls',
			{
				text: 'Emergency alert',
				user_ids: ['123', '456'],
				retry: 1,
				loop: 2,
				actions: [
					{
						label: 'View details',
						action: {
							type: 'open.url',
							data: { web: 'https://cliq.zoho.com' },
						},
					},
				],
			},
			{ appkey: 'abc123' },
		);
		expect(result[0].json).toMatchObject({ success: true, bot_unique_name: 'supportbot' });
	});

	it('should trigger bot calls successfully in raw mode with stringified JSON', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"text":"Emergency alert","retry":1,"loop":1}');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/calls',
			{ text: 'Emergency alert', retry: 1, loop: 1 },
			{},
		);
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"text":"Emergency alert","retry":1,"loop":1}')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce('');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ status: 'success' });
	});

	it('should wrap one-item array responses when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string, _itemIndex: number, fallback?: unknown) => {
				if (paramName === 'botUniqueName') return 'supportbot';
				if (paramName === 'inputMode') return 'raw';
				if (paramName === 'callPayload') return '{"text":"Emergency alert","retry":1,"loop":1}';
				if (paramName === 'includeEnhancedOutput') return false;
				if (paramName === 'appkey') return '';
				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue([{ status: 'success' }] as unknown as IDataObject);

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			data: [{ status: 'success' }],
		});
	});

	it('should trigger bot calls successfully in raw mode with object payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ text: 'Emergency alert', retry: 2, loop: 1 });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/calls',
			{ text: 'Emergency alert', retry: 2, loop: 1 },
			{},
		);
	});

	it('should build invoke.function, system.api, and open.dialog actions in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(2)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [
					{
						label: 'Acknowledge',
						actionType: 'invoke.function',
						functionName: 'testFunction',
						iconInputMode: 'known',
						knownIconId: 'tick',
						hint: 'tap to ack',
						key: 'ack_btn',
					},
					{
						label: 'Delegate',
						actionType: 'system.api',
						systemApi: 'audiocall/1234',
						icon: '   ',
					},
					{
						label: 'Open Dialog',
						actionType: 'open.dialog',
						dialogData: '{"id":"dlg1","title":"Alert"}',
					},
				],
			})
			.mockReturnValueOnce(true)
			.mockReturnValueOnce('');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/calls',
			{
				text: 'Emergency alert',
				retry: 2,
				loop: 1,
				actions: [
					{
						label: 'Acknowledge',
						icon: 'tick',
						hint: 'tap to ack',
						key: 'ack_btn',
						action: {
							type: 'invoke.function',
							data: { name: 'testFunction' },
						},
					},
					{
						label: 'Delegate',
						action: {
							type: 'system.api',
							data: { api: 'audiocall/1234' },
						},
					},
					{
						label: 'Open Dialog',
						action: {
							type: 'open.dialog',
							data: { id: 'dlg1', title: 'Alert' },
						},
					},
				],
			},
			{},
		);
	});

	it('should include known Cliq icon ID for actions', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(2)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [
					{
						label: 'Open',
						actionType: 'open.url',
						openUrl: 'https://cliq.zoho.com',
						knownIconId: 'tick',
					},
				],
			})
			.mockReturnValueOnce(true)
			.mockReturnValueOnce('');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/calls',
			{
				text: 'Emergency alert',
				retry: 2,
				loop: 1,
				actions: [
					{
						label: 'Open',
						icon: 'tick',
						action: {
							type: 'open.url',
							data: { web: 'https://cliq.zoho.com' },
						},
					},
				],
			},
			{},
		);
	});

	it('should throw when unsupported known icon ID is provided', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(2)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [
					{
						label: 'Open',
						actionType: 'open.url',
						openUrl: 'https://cliq.zoho.com',
						knownIconId: 'unknown-icon',
					},
				],
			});

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Known Icon must be one of the supported Cliq icon keywords');
	});

	it('should ignore blank appkey and send empty query params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(2)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({})
			.mockReturnValueOnce(false)
			.mockReturnValueOnce('   ');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/calls',
			{ text: 'Emergency alert', retry: 2, loop: 1 },
			{},
		);
	});

	it('should omit blank optional action hint and key values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [
					{
						label: 'Open',
						actionType: 'open.url',
						openUrl: 'https://cliq.zoho.com',
						hint: '   ',
						key: '   ',
					},
				],
			})
			.mockReturnValueOnce(true)
			.mockReturnValueOnce('');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/calls',
			{
				text: 'Emergency alert',
				retry: 1,
				loop: 1,
				actions: [
					{
						label: 'Open',
						action: {
							type: 'open.url',
							data: { web: 'https://cliq.zoho.com' },
						},
					},
				],
			},
			{},
		);
	});

	it('should throw for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const requiredScope = getRequiredScopeForOperation('bot', 'triggerCalls');
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'bot';
			if (paramName === 'operation') return 'triggerCalls';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await triggerCalls.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeDefined();
		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'bot',
			operation: 'triggerCalls',
			requiredScopes: [requiredScope],
			missingScopes: [requiredScope],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should throw for invalid payload in raw mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ retry: 2 });

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Call Payload text is required');
	});

	it('should handle empty trigger response payload safely', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(2)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({})
			.mockReturnValueOnce(true)
			.mockReturnValueOnce('');
		mockZohoCliqApiRequest.mockResolvedValue(undefined as unknown as IDataObject);

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: true,
			bot_unique_name: 'supportbot',
		});
	});

	it('should handle null trigger response payload safely', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(2)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({})
			.mockReturnValueOnce(true)
			.mockReturnValueOnce('');
		mockZohoCliqApiRequest.mockResolvedValue(null as unknown as IDataObject);

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: true,
			bot_unique_name: 'supportbot',
		});
	});

	it('should throw when app key is too long', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(2)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({})
			.mockReturnValueOnce(false)
			.mockReturnValueOnce('a'.repeat(301));

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('App Key is too long');
	});

	it('should throw for malformed raw JSON payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"text":');

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Call Payload must be a valid JSON object when provided as text');
	});

	it('should throw when structured action label is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [{ actionType: 'open.url', openUrl: 'https://cliq.zoho.com' }],
			});

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Call Payload actions[0].label is required');
	});

	it('should throw when structured action type is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [{ label: 'Missing type' }],
			});

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow(
			'Call Payload actions[0].action.type must be one of: open.url, invoke.function, system.api, open.dialog',
		);
	});

	it('should throw when open.url action misses openUrl in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [{ label: 'View', actionType: 'open.url' }],
			});

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Call Payload actions[0].action.data.web is required for open.url');
	});

	it('should throw when invoke.function action misses functionName in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [{ label: 'Invoke', actionType: 'invoke.function' }],
			});

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Call Payload actions[0].action.data.name is required for invoke.function');
	});

	it('should throw when system.api action misses systemApi in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [{ label: 'Delegate', actionType: 'system.api' }],
			});

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Call Payload actions[0].action.data.api is required for system.api');
	});

	it('should throw when system.api action uses unsupported system action', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [{ label: 'Delegate', actionType: 'system.api', systemApi: 'unknownaction/1234' }],
			});

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Call Payload actions[0].action.data.api uses unsupported system action');
	});

	it('should throw when system.api action is missing user id segment', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [{ label: 'Share', actionType: 'system.api', systemApi: 'locationpermission' }],
			});

		await expect(
			triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow(
			'Call Payload actions[0].action.data.api must use format "<system_action>/<user_id>"',
		);
	});

	it('should default open.dialog action data to empty object when dialogData is omitted', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({
				action: [{ label: 'Dialog', actionType: 'open.dialog' }],
			});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/calls',
			{
				text: 'Emergency alert',
				retry: 1,
				loop: 1,
				actions: [
					{
						label: 'Dialog',
						action: {
							type: 'open.dialog',
							data: {},
						},
					},
				],
			},
			{},
		);
	});

	it('should return paired item error when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ retry: 2 });

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Call Payload text is required',
			}),
		);
	});

	it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'bot';
			if (paramName === 'operation') return 'triggerCalls';
			return undefined;
		});

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bot',
				operation: 'triggerCalls',
			}),
		);
	});

	it('should return generic error when continueOnFail is enabled and non-object error is thrown', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockRejectedValue(null);

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'An unexpected issue occurred with the API request',
			}),
		);
	});

	it('should map URL-pattern API errors to actionable bot unique name guidance', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('fakebot')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('Emergency alert')
			.mockReturnValueOnce('')
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				data: {
					message: 'The request URL is invalid. Please check the URL pattern.',
				},
			},
		});

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'INVALID_BOT_UNIQUE_NAME',
				bot_unique_name: 'fakebot',
			}),
		);
		expect(String(result[0].json.message)).not.toContain('URL');
	});

	it('should return recoverable bot guidance when only AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: 'true' },
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string, _itemIndex: number, fallback?: unknown) => {
				if (paramName === 'enableAiErrorMode') return 'true';
				if (paramName === 'botUniqueName') return 'fakebot';
				if (paramName === 'inputMode') return 'structured';
				if (paramName === 'text') return 'Emergency alert';
				if (paramName === 'userIds') return '';
				if (paramName === 'retry') return 1;
				if (paramName === 'loop') return 1;
				if (paramName === 'actions') return {};
				if (paramName === 'includeEnhancedOutput') return true;
				if (paramName === 'appkey') return '';
				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				data: {
					message: 'The request URL is invalid. Please check the URL pattern.',
				},
			},
		});

		const result = await triggerCalls.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bot',
				operation: 'triggerCalls',
				reason: 'INVALID_BOT_UNIQUE_NAME',
				bot_unique_name: 'fakebot',
			}),
		);
	});
});
