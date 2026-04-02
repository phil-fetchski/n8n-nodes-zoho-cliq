import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

import {
	RESOURCE_NAME,
	appendExecutionData,
	appendOperationError,
	applyResourceDisplayOptions,
	buildDeterministicBuilderErrorPayload,
	toPrettyAndStringPayload,
} from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/common';
import { createTestExecutionContext } from './testExecutionContext';

function makeMockExecuteFunctions(): IExecuteFunctions {
	return createTestExecutionContext({ continueOnFail: true });
}

describe('Message Component Builder - common helpers', () => {
	it('should expose resource name constant', () => {
		expect(RESOURCE_NAME).toBe('messageComponentBuilder');
	});

	it('should apply resource and operation display options', () => {
		const properties: INodeProperties[] = [
			{ displayName: 'A', name: 'a', type: 'string', default: '' },
		];
		const applied = applyResourceDisplayOptions(properties, 'buildComponents');
		expect(applied[0].displayOptions?.show).toMatchObject({
			resource: ['messageComponentBuilder'],
			operation: ['buildComponents'],
		});
	});

	it('should append execution data with paired item metadata', () => {
		const returnData: INodeExecutionData[] = [];
		const context = makeMockExecuteFunctions();

		appendExecutionData(context, returnData, 3, { ok: true });
		expect(returnData).toHaveLength(1);
		expect(returnData[0]).toMatchObject({ json: { ok: true }, pairedItem: { item: 3 } });
	});

	it('should append fallback error message in continueOnFail mode for non-Error values', () => {
		const returnData: INodeExecutionData[] = [];
		const context = makeMockExecuteFunctions();

		appendOperationError(context, returnData, 0, 'boom', {
			fallbackMessage: 'fallback message',
			operation: 'buildButtons',
		});
		expect(returnData[0].json).toMatchObject({
			error: 'fallback message',
			resource: 'messageComponentBuilder',
			operation: 'buildButtons',
		});
	});

	it('should append real error message in continueOnFail mode for Error values', () => {
		const returnData: INodeExecutionData[] = [];
		const context = makeMockExecuteFunctions();

		appendOperationError(context, returnData, 0, new Error('real message'), {
			fallbackMessage: 'fallback message',
			operation: 'buildComponents',
		});
		expect(returnData[0].json).toMatchObject({
			error: 'real message',
			resource: 'messageComponentBuilder',
			operation: 'buildComponents',
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
				operation: 'buildButtons',
			}),
		).toThrow(NodeOperationError);
		expect(() =>
			appendOperationError(context, [], 1, 'boom', {
				fallbackMessage: 'fallback message',
				operation: 'buildButtons',
			}),
		).toThrow('fallback message');
	});

	it('should preserve Error instance in throw path when continueOnFail is false', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn(() => ({ name: 'Zoho Cliq' })),
		} as unknown as IExecuteFunctions;
		const err = new Error('kept');
		expect(() =>
			appendOperationError(context, [], 1, err, {
				fallbackMessage: 'fallback',
				operation: 'buildButtons',
			}),
		).toThrow('kept');
	});

	it('should build deterministic helper error payloads with defaults', () => {
		expect(buildDeterministicBuilderErrorPayload('bad buttons', 'buildButtons')).toMatchObject({
			error: 'bad buttons',
			resource: 'messageComponentBuilder',
			operation: 'buildButtons',
		});
		expect(
			String(buildDeterministicBuilderErrorPayload('bad buttons', 'buildButtons').hint),
		).toContain('buttonsJsonPretty');
	});

	it('should use wrapper-toggle-specific guidance when wrapper boolean validation fails', () => {
		expect(
			buildDeterministicBuilderErrorPayload(
				'includeButtonsWrapper must be a boolean',
				'buildButtons',
			),
		).toMatchObject({
			error: 'includeButtonsWrapper must be a boolean',
			resource: 'messageComponentBuilder',
			operation: 'buildButtons',
		});
		expect(
			String(
				buildDeterministicBuilderErrorPayload(
					'includeButtonsWrapper must be a boolean',
					'buildButtons',
				).hint,
			),
		).toContain('Wrapper toggles');
	});

	it('should preserve an explicitly provided deterministic helper hint', () => {
		expect(
			buildDeterministicBuilderErrorPayload(
				'custom message',
				'buildButtons',
				'Use the exact custom hint',
			),
		).toMatchObject({
			error: 'custom message',
			resource: 'messageComponentBuilder',
			operation: 'buildButtons',
			hint: 'Use the exact custom hint',
		});
	});

	it('should serialize payload to pretty and string forms', () => {
		const payload = { a: 1 };
		const result = toPrettyAndStringPayload(payload);
		expect(result.pretty).toEqual(payload);
		expect(result.payload).toBe(JSON.stringify(payload, null, 2));
	});
});
