/**
 * Tests for ZohoCliq Main Node (VersionedNodeType)
 * Verifies node instantiation, version routing, and metadata
 */

import { ZohoCliq } from '../../../nodes/ZohoCliq/ZohoCliq.node';
import { ZohoCliqV1 } from '../../../nodes/ZohoCliq/v1/ZohoCliqV1.node';
import { NODE_DESCRIPTION, SUBTITLE_EXPRESSION } from '../../../nodes/ZohoCliq/constants';

describe('ZohoCliq Main Node (VersionedNodeType)', () => {
	let nodeInstance: ZohoCliq;

	beforeEach(() => {
		nodeInstance = new ZohoCliq();
	});

	describe('Node Instantiation', () => {
		it('should create node instance successfully', () => {
			expect(nodeInstance).toBeDefined();
			expect(nodeInstance).toBeInstanceOf(ZohoCliq);
		});

		it('should extend VersionedNodeType', () => {
			expect(nodeInstance.constructor.name).toBe('ZohoCliq');
			// VersionedNodeType has nodeVersions property
			expect(nodeInstance).toHaveProperty('nodeVersions');
		});
	});

	describe('Base Description Metadata', () => {
		it('should have correct display name', () => {
			expect(nodeInstance.description.displayName).toBe('Zoho Cliq');
		});

		it('should have correct internal name', () => {
			expect(nodeInstance.description.name).toBe('zohoCliq');
		});

		it('should have correct description text', () => {
			expect(nodeInstance.description.description).toBe(NODE_DESCRIPTION);
		});

		it('should have correct node group', () => {
			expect(nodeInstance.description.group).toEqual(['output']);
		});

		it('should have correct icon path', () => {
			expect(nodeInstance.description.icon).toEqual({
				light: 'file:ZohoCliqNodeIconLight.svg',
				dark: 'file:ZohoCliqNodeIconDark.svg',
			});
		});

		it('should have subtitle with resource and operation', () => {
			expect(nodeInstance.description.subtitle).toBe(SUBTITLE_EXPRESSION);
		});

		it('should have default version set to 1', () => {
			expect(nodeInstance.description.defaultVersion).toBe(1);
		});
	});

	describe('Version Routing', () => {
		it('should have nodeVersions property', () => {
			expect(nodeInstance.nodeVersions).toBeDefined();
			expect(typeof nodeInstance.nodeVersions).toBe('object');
		});

		it('should register version 1', () => {
			expect(nodeInstance.nodeVersions[1]).toBeDefined();
		});

		it('should map version 1 to ZohoCliqV1 instance', () => {
			const v1Instance = nodeInstance.nodeVersions[1];
			expect(v1Instance).toBeInstanceOf(ZohoCliqV1);
		});

		it('should pass base description to version 1 node', () => {
			const v1Instance = nodeInstance.nodeVersions[1] as ZohoCliqV1;
			expect(v1Instance.description.displayName).toBe('Zoho Cliq');
			expect(v1Instance.description.name).toBe('zohoCliq');
			expect(v1Instance.description.icon).toEqual({
				light: 'file:ZohoCliqNodeIconLight.svg',
				dark: 'file:ZohoCliqNodeIconDark.svg',
			});
		});

		it('should only have version 1 registered', () => {
			const versionKeys = Object.keys(nodeInstance.nodeVersions);
			expect(versionKeys).toEqual(['1']);
		});
	});

	describe('Version 1 Node Integration', () => {
		it('should have version 1 with correct version number', () => {
			const v1Instance = nodeInstance.nodeVersions[1] as ZohoCliqV1;
			expect(v1Instance.description.version).toBe(1);
		});

		it('should have version 1 with execute method', () => {
			const v1Instance = nodeInstance.nodeVersions[1] as ZohoCliqV1;
			expect(v1Instance.execute).toBeDefined();
			expect(typeof v1Instance.execute).toBe('function');
		});

		it('should have version 1 with methods object', () => {
			const v1Instance = nodeInstance.nodeVersions[1] as ZohoCliqV1;
			expect(v1Instance.methods).toBeDefined();
			expect(v1Instance.methods.listSearch).toBeDefined();
			expect(v1Instance.methods.resourceMapping).toBeDefined();
		});

		it('should have version 1 with correct credentials', () => {
			const v1Instance = nodeInstance.nodeVersions[1] as ZohoCliqV1;
			expect(v1Instance.description.credentials).toEqual([
				{
					name: 'zohoCliqOAuth2Api',
					required: true,
				},
			]);
		});

		it('should have version 1 with properties array', () => {
			const v1Instance = nodeInstance.nodeVersions[1] as ZohoCliqV1;
			expect(v1Instance.description.properties).toBeDefined();
			expect(Array.isArray(v1Instance.description.properties)).toBe(true);
			expect(v1Instance.description.properties.length).toBeGreaterThan(0);
		});

		it('should have version 1 marked as usable as AI tool', () => {
			const v1Instance = nodeInstance.nodeVersions[1] as ZohoCliqV1;
			expect(v1Instance.description.usableAsTool).toBe(true);
		});
	});

	describe('Node Type Structure', () => {
		it('should follow VersionedNodeType pattern', () => {
			// VersionedNodeType requires description and nodeVersions
			expect(nodeInstance.description).toBeDefined();
			expect(nodeInstance.nodeVersions).toBeDefined();
		});

		it('should have description as base description', () => {
			// The main node's description should be the base description
			expect(nodeInstance.description.defaultVersion).toBe(1);
			// Should NOT have version-specific properties like 'version' or 'properties'
			expect(nodeInstance.description).not.toHaveProperty('version');
		});

		it('should delegate version-specific behavior to version nodes', () => {
			// Main node should not have execute method at base level
			expect(nodeInstance).not.toHaveProperty('execute');
			// Version-specific node should have execute
			const v1Instance = nodeInstance.nodeVersions[1];
			expect(v1Instance).toHaveProperty('execute');
		});
	});
});
