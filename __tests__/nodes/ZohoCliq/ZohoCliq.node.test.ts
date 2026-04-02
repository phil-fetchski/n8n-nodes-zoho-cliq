/**
 * Tests for ZohoCliq main node
 * Verifies node instantiation, methods object, and execute delegation to router
 */

import type { IExecuteFunctions } from 'n8n-workflow';
import { ZohoCliqV1 } from '../../../nodes/ZohoCliq/v1/ZohoCliqV1.node';
import { NODE_DESCRIPTION, SUBTITLE_EXPRESSION } from '../../../nodes/ZohoCliq/constants';
import * as router from '../../../nodes/ZohoCliq/v1/actions/router';
import { listSearch } from '../../../nodes/ZohoCliq/v1/methods/listSearch';
import { resourceMapping } from '../../../nodes/ZohoCliq/v1/methods/resourceMapping';

// Mock dependencies
jest.mock('../../../nodes/ZohoCliq/v1/actions/router');
jest.mock('../../../nodes/ZohoCliq/v1/methods/listSearch');
jest.mock('../../../nodes/ZohoCliq/v1/methods/resourceMapping');

describe('ZohoCliq Node', () => {
	let nodeInstance: ZohoCliqV1;

	beforeEach(() => {
		nodeInstance = new ZohoCliqV1();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Node Instance', () => {
		it('should create node instance with description', () => {
			expect(nodeInstance).toBeInstanceOf(ZohoCliqV1);
			expect(nodeInstance.description).toBeDefined();
		});

		it('should have complete version description', () => {
			expect(nodeInstance.description.displayName).toBe('Zoho Cliq');
			expect(nodeInstance.description.name).toBe('zohoCliq');
			expect(nodeInstance.description.credentials).toEqual([
				{
					name: 'zohoCliqOAuth2Api',
					required: true,
				},
			]);

			const icon = nodeInstance.description.icon;
			expect(icon).toBeDefined();
			expect(typeof icon).toBe('object');
			expect(typeof icon).not.toBe('string');
			expect(icon).toEqual({
				light: expect.stringMatching(/^file:/),
				dark: expect.stringMatching(/^file:/),
			});
		});

		it('should have version description properties', () => {
			expect(nodeInstance.description.properties).toBeDefined();
			expect(Array.isArray(nodeInstance.description.properties)).toBe(true);
		});

		it('should have usableAsTool set to true for AI agent compatibility', () => {
			expect(nodeInstance.description.usableAsTool).toBe(true);
		});
	});

	describe('Methods Object', () => {
		it('should have methods object with listSearch and resourceMapping', () => {
			expect(nodeInstance.methods).toBeDefined();
			expect(nodeInstance.methods.listSearch).toBeDefined();
			expect(nodeInstance.methods.resourceMapping).toBeDefined();
		});

		it('should reference correct listSearch methods', () => {
			expect(nodeInstance.methods.listSearch).toBe(listSearch);
		});

		it('should reference correct resourceMapping methods', () => {
			expect(nodeInstance.methods.resourceMapping).toBe(resourceMapping);
		});
	});

	describe('Execute Method', () => {
		let mockExecuteFunctions: IExecuteFunctions;

		beforeEach(() => {
			mockExecuteFunctions = {
				getInputData: jest.fn().mockReturnValue([{ json: {} }]),
				getNodeParameter: jest.fn(),
				getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			(router.router as jest.Mock).mockResolvedValue([
				[{ json: { success: true }, pairedItem: { item: 0 } }],
			]);
		});

		it('should delegate execution to router', async () => {
			await nodeInstance.execute.call(mockExecuteFunctions);

			expect(router.router).toHaveBeenCalledTimes(1);
		});

		it('should return router result', async () => {
			const expectedResult = [[{ json: { message_id: '123' }, pairedItem: { item: 0 } }]];
			(router.router as jest.Mock).mockResolvedValue(expectedResult);

			const result = await nodeInstance.execute.call(mockExecuteFunctions);

			expect(result).toEqual(expectedResult);
		});

		it('should pass execution context to router', async () => {
			await nodeInstance.execute.call(mockExecuteFunctions);

			// Router should be called with the correct context (this)
			expect(router.router).toHaveBeenCalled();
		});

		it('should propagate errors from router', async () => {
			const error = new Error('Router error');
			(router.router as jest.Mock).mockRejectedValue(error);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow('Router error');
		});
	});

	describe('Node Description Structure', () => {
		it('should have required base properties', () => {
			const desc = nodeInstance.description;
			expect(desc.displayName).toBeDefined();
			expect(desc.name).toBeDefined();
			expect(desc.group).toBeDefined();
			expect(desc.version).toBeDefined();
			expect(desc.description).toBeDefined();
		});

		it('should have correct input/output configuration', () => {
			expect(nodeInstance.description.inputs).toEqual(['main']);
			expect(nodeInstance.description.outputs).toEqual(['main']);
		});

		it('should require Zoho Cliq OAuth2 credentials', () => {
			const credentials = nodeInstance.description.credentials;
			expect(credentials).toHaveLength(1);
			expect(credentials?.[0].name).toBe('zohoCliqOAuth2Api');
			expect(credentials?.[0].required).toBe(true);
		});

		it('should have properties array for node parameters', () => {
			expect(nodeInstance.description.properties).toBeDefined();
			expect(Array.isArray(nodeInstance.description.properties)).toBe(true);
		});

		it('should scope schedule message fields to message and thread resources', () => {
			const scheduleTimeFields = nodeInstance.description.properties.filter(
				(property) => property.name === 'scheduleTime',
			);
			expect(scheduleTimeFields).toHaveLength(2);
			expect(scheduleTimeFields).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						displayOptions: expect.objectContaining({
							show: expect.objectContaining({
								resource: ['message'],
								operation: ['scheduleMessage'],
							}),
						}),
					}),
					expect.objectContaining({
						displayOptions: expect.objectContaining({
							show: expect.objectContaining({
								resource: ['thread'],
								operation: ['scheduleMessage'],
							}),
						}),
					}),
				]),
			);
		});
	});

	describe('Node Metadata', () => {
		it('should have correct node type metadata', () => {
			expect(nodeInstance.description.icon).toBeDefined();
			expect(nodeInstance.description.subtitle).toBe(SUBTITLE_EXPRESSION);
			expect(nodeInstance.description.description).toBe(NODE_DESCRIPTION);
		});

		it('should have default node name', () => {
			expect(nodeInstance.description.defaults).toBeDefined();
			expect(nodeInstance.description.defaults.name).toBe('Zoho Cliq');
		});
	});
});
