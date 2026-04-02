import type { INodeExecutionData } from 'n8n-workflow';

import * as buildButtons from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildButtons.operation';
import * as buildComponents from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildComponents.operation';
import { createTestExecutionContext } from './testExecutionContext';

const mockItems: INodeExecutionData[] = [{ json: {} }];

describe('Message Component Builder - Collection Operations', () => {
	describe('buildComponents', () => {
		it('should build multiple components and emit csv payload', async () => {
			const context = createTestExecutionContext({
				params: {
					slides: {
						slide: [
							{ enabled: true, slideInputMode: 'raw', type: 'table', rawSlide: { type: 'table' } },
							{
								enabled: true,
								slideInputMode: 'raw',
								type: 'images',
								rawSlide: { type: 'images', data: ['https://example.com/a.png'] },
							},
						],
					},
					includeSlidesWrapper: false,
				},
			});

			const result = await buildComponents.execute.call(context, mockItems, '');
			expect(result[0].json).toHaveProperty('componentsJsonPretty');
			expect(result[0].json).toHaveProperty('componentsPayload');
			expect(result[0].json).toHaveProperty('componentsCsv');
			expect(String((result[0].json as Record<string, unknown>).componentsCsv)).toContain(
				'"type":"table"',
			);
		});

		it('should include slides wrapper payload when enabled', async () => {
			const context = createTestExecutionContext({
				params: {
					slides: {
						slide: [
							{ enabled: true, slideInputMode: 'raw', type: 'table', rawSlide: { type: 'table' } },
						],
					},
					includeSlidesWrapper: true,
				},
			});

			const result = await buildComponents.execute.call(context, mockItems, '');
			expect(result[0].json).toHaveProperty('wrapperPrefixPayload');
			expect(String((result[0].json as Record<string, unknown>).wrapperPrefixPayload)).toContain(
				'"slides":',
			);
		});

		it('should throw when no components are provided', async () => {
			const context = createTestExecutionContext({
				params: {
					slides: {},
					includeSlidesWrapper: false,
				},
			});

			await expect(buildComponents.execute.call(context, mockItems, '')).rejects.toThrow(
				'At least one component is required',
			);
		});

		it('should validate includeSlidesWrapper boolean', async () => {
			const context = createTestExecutionContext({
				params: {
					slides: {
						slide: [
							{ enabled: true, slideInputMode: 'raw', type: 'table', rawSlide: { type: 'table' } },
						],
					},
					includeSlidesWrapper: 'true',
				},
			});

			await expect(buildComponents.execute.call(context, mockItems, '')).rejects.toThrow(
				'includeSlidesWrapper must be a boolean',
			);
		});

		it('should default null includeSlidesWrapper to false', async () => {
			const context = createTestExecutionContext({
				params: {
					slides: {
						slide: [
							{ enabled: true, slideInputMode: 'raw', type: 'table', rawSlide: { type: 'table' } },
						],
					},
					includeSlidesWrapper: null,
				},
			});

			const result = await buildComponents.execute.call(context, mockItems, '');
			expect((result[0].json as Record<string, unknown>).wrapperPrefixPayload).toBeUndefined();
		});

		it('should return per-item errors on continueOnFail', async () => {
			const context = createTestExecutionContext({
				params: {
					slides: {},
					includeSlidesWrapper: false,
				},
				continueOnFail: true,
			});

			const result = await buildComponents.execute.call(context, mockItems, '');
			expect(result[0].json).toMatchObject({
				error: 'At least one component is required',
				resource: 'messageComponentBuilder',
				operation: 'buildComponents',
			});
			expect(String((result[0].json as Record<string, unknown>).hint)).toContain(
				'componentsJsonPretty',
			);
		});
	});

	describe('buildButtons', () => {
		it('should build multiple button payloads', async () => {
			const context = createTestExecutionContext({
				params: {
					buttons: {
						button: [
							{
								buttonInputMode: 'raw',
								rawButton: {
									label: 'Open',
									action: { type: 'open.url', data: { url: 'https://example.com' } },
								},
							},
							{
								buttonInputMode: 'raw',
								rawButton: {
									label: 'Preview',
									action: { type: 'preview.url', data: { url: 'https://example.com/preview' } },
								},
							},
						],
					},
					includeButtonsWrapper: false,
				},
			});

			const result = await buildButtons.execute.call(context, mockItems, '');
			expect(result[0].json).toHaveProperty('buttonsJsonPretty');
			expect(result[0].json).toHaveProperty('buttonsPayload');
			expect((result[0].json as Record<string, unknown>).wrapperPrefixPayload).toBeUndefined();
		});

		it('should include buttons wrapper payload when enabled', async () => {
			const context = createTestExecutionContext({
				params: {
					buttons: {
						button: [
							{
								buttonInputMode: 'raw',
								rawButton: {
									label: 'Open',
									action: { type: 'open.url', data: { url: 'https://example.com' } },
								},
							},
						],
					},
					includeButtonsWrapper: true,
				},
			});

			const result = await buildButtons.execute.call(context, mockItems, '');
			expect(result[0].json).toHaveProperty('wrapperPrefixPayload');
			expect(String((result[0].json as Record<string, unknown>).wrapperPrefixPayload)).toContain(
				'"buttons":',
			);
		});

		it('should throw when no buttons are provided', async () => {
			const context = createTestExecutionContext({
				params: {
					buttons: {},
					includeButtonsWrapper: false,
				},
			});

			await expect(buildButtons.execute.call(context, mockItems, '')).rejects.toThrow(
				'At least one button is required',
			);
		});

		it('should validate includeButtonsWrapper boolean', async () => {
			const context = createTestExecutionContext({
				params: {
					buttons: {
						button: [
							{
								buttonInputMode: 'raw',
								rawButton: {
									label: 'Open',
									action: { type: 'open.url', data: { url: 'https://example.com' } },
								},
							},
						],
					},
					includeButtonsWrapper: 'true',
				},
			});

			await expect(buildButtons.execute.call(context, mockItems, '')).rejects.toThrow(
				'includeButtonsWrapper must be a boolean',
			);
		});

		it('should default null includeButtonsWrapper to false', async () => {
			const context = createTestExecutionContext({
				params: {
					buttons: {
						button: [
							{
								buttonInputMode: 'raw',
								rawButton: {
									label: 'Open',
									action: { type: 'open.url', data: { url: 'https://example.com' } },
								},
							},
						],
					},
					includeButtonsWrapper: null,
				},
			});

			const result = await buildButtons.execute.call(context, mockItems, '');
			expect((result[0].json as Record<string, unknown>).wrapperPrefixPayload).toBeUndefined();
		});

		it('should return per-item errors on continueOnFail', async () => {
			const context = createTestExecutionContext({
				params: {
					buttons: {},
					includeButtonsWrapper: false,
				},
				continueOnFail: true,
			});

			const result = await buildButtons.execute.call(context, mockItems, '');
			expect(result[0].json).toMatchObject({
				error: 'At least one button is required',
				resource: 'messageComponentBuilder',
				operation: 'buildButtons',
			});
			expect(String((result[0].json as Record<string, unknown>).hint)).toContain(
				'buttonsJsonPretty',
			);
		});
	});
});
