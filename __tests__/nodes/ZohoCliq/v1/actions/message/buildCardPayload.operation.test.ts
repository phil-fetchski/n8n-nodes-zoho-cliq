import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import * as buildCardPayload from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildCardPayload.operation';
import * as messagePayload from '../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';

describe('ZohoCliq - Message - Build Card Payload Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const items: INodeExecutionData[] = [{ json: {} }];
	let resolveCardPayloadSpy: jest.SpyInstance;

	const createContext = (
		params: Record<string, unknown>,
		continueOnFail = false,
	): IExecuteFunctions =>
		({
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (params[name] !== undefined) {
					return params[name];
				}
				return fallback;
			}),
			getNode: jest.fn(() => ({ name: 'Zoho Cliq' })),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data, meta) =>
					data.map((entry: INodeExecutionData) => ({
						...entry,
						pairedItem: meta.itemData,
					})),
				),
			},
		}) as unknown as IExecuteFunctions;

	beforeEach(() => {
		resolveCardPayloadSpy = jest.spyOn(messagePayload, 'resolveCardPayload');
	});

	afterEach(() => {
		resolveCardPayloadSpy.mockRestore();
	});

	it('should build structured card payload output', async () => {
		mockExecuteFunctions = createContext({
			cardInputMode: 'structured',
			richText: '  Daily Summary  ',
			cardTitle: 'Status Update',
			cardTheme: 'modern-inline',
			slides: {
				slide: [
					{
						enabled: true,
						slideInputMode: 'structured',
						type: 'text',
						title: 'Summary',
						textData: 'All systems operational',
					},
				],
			},
			buttons: {},
		});

		const result = await buildCardPayload.execute.call(mockExecuteFunctions, items, '');
		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			cardJsonPretty: {
				text: 'Daily Summary',
				card: {
					title: 'Status Update',
					theme: 'modern-inline',
				},
			},
		});
		expect((result[0].json as Record<string, unknown>).cardPayload).toEqual(expect.any(String));
		const parsedCardPayload = JSON.parse(
			(result[0].json as Record<string, unknown>).cardPayload as string,
		);
		expect(parsedCardPayload).toEqual(
			(result[0].json as Record<string, unknown>).cardJsonPretty as Record<string, unknown>,
		);
	});

	it('should build raw JSON card payload output', async () => {
		mockExecuteFunctions = createContext({
			cardInputMode: 'raw',
			richPayloadJson: {
				text: 'Raw mode',
				card: {
					title: 'Raw Card',
					theme: 'basic',
				},
			},
		});

		const result = await buildCardPayload.execute.call(mockExecuteFunctions, items, '');
		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			cardJsonPretty: {
				text: 'Raw mode',
				card: {
					title: 'Raw Card',
					theme: 'basic',
				},
			},
		});
		const parsedCardPayload = JSON.parse(
			(result[0].json as Record<string, unknown>).cardPayload as string,
		);
		expect(parsedCardPayload).toEqual(
			(result[0].json as Record<string, unknown>).cardJsonPretty as Record<string, unknown>,
		);
	});

	it('should return per-item errors when continueOnFail is enabled', async () => {
		mockExecuteFunctions = createContext(
			{
				cardInputMode: 'raw',
				richPayloadJson: {},
			},
			true,
		);

		const result = await buildCardPayload.execute.call(mockExecuteFunctions, items, '');
		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			error: expect.any(String),
			resource: 'messageComponentBuilder',
			operation: 'buildCardPayload',
		});
		expect(String((result[0].json as Record<string, unknown>).hint)).toContain('cardJsonPretty');
	});

	it('should throw NodeOperationError for non-Error failures when continueOnFail is false', async () => {
		mockExecuteFunctions = createContext(
			{
				cardInputMode: 'structured',
				richText: 'hello',
			},
			false,
		);
		resolveCardPayloadSpy.mockImplementation(() => {
			throw 'boom';
		});

		await expect(buildCardPayload.execute.call(mockExecuteFunctions, items, '')).rejects.toThrow(
			'Unable to build card payload',
		);
	});

	it('should return generic error text for non-Error failures when continueOnFail is enabled', async () => {
		mockExecuteFunctions = createContext(
			{
				cardInputMode: 'structured',
				richText: 'hello',
			},
			true,
		);
		resolveCardPayloadSpy.mockImplementation(() => {
			throw 'boom';
		});

		const result = await buildCardPayload.execute.call(mockExecuteFunctions, items, '');
		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			error: 'Unable to build card payload',
			resource: 'messageComponentBuilder',
			operation: 'buildCardPayload',
		});
	});

	it('should rethrow Error instances when continueOnFail is disabled', async () => {
		mockExecuteFunctions = createContext(
			{
				cardInputMode: 'structured',
				richText: 'hello',
			},
			false,
		);
		resolveCardPayloadSpy.mockImplementation(() => {
			throw new Error('card build failed');
		});

		await expect(buildCardPayload.execute.call(mockExecuteFunctions, items, '')).rejects.toThrow(
			'card build failed',
		);
	});

	it('should scope description fields to messageComponentBuilder/buildCardPayload', () => {
		const notice = buildCardPayload.description.find(
			(property) => property.name === 'buildCardPayloadNotice',
		);
		const cardInputMode = buildCardPayload.description.find(
			(property) => property.name === 'cardInputMode',
		);

		expect(notice?.displayOptions?.show).toMatchObject({
			resource: ['messageComponentBuilder'],
			operation: ['buildCardPayload'],
		});

		expect(cardInputMode?.displayOptions?.show).toMatchObject({
			resource: ['messageComponentBuilder'],
			operation: ['buildCardPayload'],
		});
		expect(
			(cardInputMode?.displayOptions?.show as Record<string, unknown>)?.messageType,
		).toBeUndefined();
	});

	it('should mention Edit Message as a downstream consumer in the builder notice', () => {
		const notice = buildCardPayload.description.find(
			(property) => property.name === 'buildCardPayloadNotice',
		);

		expect(String(notice?.displayName ?? '')).toContain('Edit Message');
	});

	it('should mention cardJsonPretty as a deterministic helper output in the builder notice', () => {
		const notice = buildCardPayload.description.find(
			(property) => property.name === 'buildCardPayloadNotice',
		);

		expect(String(notice?.displayName ?? '')).toContain('cardJsonPretty');
	});

	it('should recommend Agent Card Payload Builder for AI tool use', () => {
		const notice = buildCardPayload.description.find(
			(property) => property.name === 'buildCardPayloadAgentToolRedirectNotice',
		);

		expect(String(notice?.displayName ?? '')).toContain('For AI-agent workflows, use');
		expect(String(notice?.displayName ?? '')).toContain(
			'manual or deterministic workflow assembly',
		);
		expect(String(notice?.displayName ?? '')).toContain('Agent Card Payload Builder');
	});
});
