import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import {
	ensureSafeObject,
	parseJsonObjectInput,
	parseJsonInput,
	serializeRichPayloadFields,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload/common';

function createContext(): IExecuteFunctions {
	return {
		getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
	} as unknown as IExecuteFunctions;
}

describe('ZohoCliq - Shared - messagePayload - common helpers', () => {
	it('should allow null and undefined values in ensureSafeObject', () => {
		const context = createContext();

		expect(() => ensureSafeObject(context, null, 0, 'payload')).not.toThrow();
		expect(() => ensureSafeObject(context, undefined, 0, 'payload')).not.toThrow();
	});

	it('should throw for primitive values in ensureSafeObject', () => {
		const context = createContext();

		expect(() => ensureSafeObject(context, 'text', 0, 'payload')).toThrow(NodeOperationError);
		expect(() => ensureSafeObject(context, 'text', 0, 'payload')).toThrow(
			'payload must be an object',
		);
	});

	it('should reject null parsed from JSON input', () => {
		const context = createContext();

		expect(() => parseJsonInput(context, 'null', 0, 'jsonBody')).toThrow(
			'jsonBody must be a non-null JSON object/array',
		);
	});

	it('should allow empty object parsing when allowEmptyObject is true', () => {
		const context = createContext();

		expect(parseJsonObjectInput(context, '', 0, 'jsonBody', { allowEmptyObject: true })).toEqual(
			{},
		);
	});

	it('should serialize rich payload object fields while preserving string fields', () => {
		const payload: IDataObject = {
			card: { title: 'Card title' },
			slides: [{ type: 'text', data: 'content' }],
			buttons: [{ label: 'Open' }],
			text: 'plain text',
		};

		const serialized = serializeRichPayloadFields(payload);

		expect(serialized.card).toBe(JSON.stringify({ title: 'Card title' }));
		expect(serialized.slides).toBe(JSON.stringify([{ type: 'text', data: 'content' }]));
		expect(serialized.buttons).toBe(JSON.stringify([{ label: 'Open' }]));
		expect(serialized.text).toBe('plain text');
	});
});
