import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

import {
	RESOURCE_NAME,
	appendExecutionData,
	appendOperationError,
	applyResourceDisplayOptions,
	buildOAuthHelperErrorPayload,
} from '../../../../../../nodes/ZohoCliq/v1/actions/oauthHelper/common';

describe('OAuth Helper - common helpers', () => {
	it('should expose resource name constant', () => {
		expect(RESOURCE_NAME).toBe('oauthHelper');
	});

	it('should apply resource and operation display options', () => {
		const properties: INodeProperties[] = [
			{ displayName: 'A', name: 'a', type: 'string', default: '' },
		];
		const applied = applyResourceDisplayOptions(properties, 'listScopePacks');

		expect(applied[0].displayOptions?.show).toMatchObject({
			resource: ['oauthHelper'],
			operation: ['listScopePacks'],
		});
	});

	it('should preserve existing displayOptions.show fields when applying resource options', () => {
		const properties: INodeProperties[] = [
			{
				displayName: 'A',
				name: 'a',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						extraFlag: [true],
					},
				},
			},
		];

		const applied = applyResourceDisplayOptions(properties, 'checkScopePack');

		expect(applied[0].displayOptions?.show).toMatchObject({
			resource: ['oauthHelper'],
			operation: ['checkScopePack'],
			extraFlag: [true],
		});
	});

	it('should append execution data with paired item metadata', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			helpers: {
				constructExecutionMetaData: jest.fn((data, meta) =>
					data.map((entry: INodeExecutionData) => ({
						...entry,
						pairedItem: meta.itemData,
					})),
				),
			},
		} as unknown as IExecuteFunctions;

		appendExecutionData(context, returnData, 2, { ok: true });

		expect(returnData).toEqual([{ json: { ok: true }, pairedItem: { item: 2 } }]);
	});

	it('should build default listScopePacks helper hints', () => {
		expect(buildOAuthHelperErrorPayload('bad', 'listScopePacks')).toMatchObject({
			success: false,
			resource: 'oauthHelper',
			operation: 'listScopePacks',
			reason: 'bad',
		});
		expect(String(buildOAuthHelperErrorPayload('bad', 'listScopePacks').hint)).toContain(
			'scope-pack catalog',
		);
	});

	it('should preserve an explicitly provided helper hint', () => {
		expect(buildOAuthHelperErrorPayload('bad', 'checkScopePack', 'custom hint')).toMatchObject({
			success: false,
			resource: 'oauthHelper',
			operation: 'checkScopePack',
			reason: 'bad',
			hint: 'custom hint',
		});
	});

	it('should append fallback error payloads in continueOnFail mode', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		appendOperationError(context, returnData, 0, 'boom', {
			fallbackMessage: 'fallback message',
			operation: 'listScopePacks',
		});

		expect(returnData[0].json).toMatchObject({
			success: false,
			resource: 'oauthHelper',
			operation: 'listScopePacks',
			reason: 'fallback message',
		});
	});

	it('should throw NodeOperationError for non-Error values when continueOnFail is false', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn(() => ({ name: 'Zoho Cliq' })),
		} as unknown as IExecuteFunctions;

		expect(() =>
			appendOperationError(context, [], 1, 'boom', {
				fallbackMessage: 'fallback message',
				operation: 'getGrantedScopes',
			}),
		).toThrow(NodeOperationError);
		expect(() =>
			appendOperationError(context, [], 1, 'boom', {
				fallbackMessage: 'fallback message',
				operation: 'getGrantedScopes',
			}),
		).toThrow('fallback message');
	});

	it('should preserve Error instances when continueOnFail is false', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn(() => ({ name: 'Zoho Cliq' })),
		} as unknown as IExecuteFunctions;
		const error = new Error('kept');

		expect(() =>
			appendOperationError(context, [], 1, error, {
				fallbackMessage: 'fallback',
				operation: 'checkScopePack',
			}),
		).toThrow('kept');
	});
});
