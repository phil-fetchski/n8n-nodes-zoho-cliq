/**
 * Zoho Cliq Node - Main Version Router
 * Following n8n's ENFORCED VersionedNodeType
 */

import type { INodeTypeBaseDescription, IVersionedNodeType } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { ZohoCliqV1 } from './v1/ZohoCliqV1.node';
import { NODE_DESCRIPTION, SUBTITLE_EXPRESSION } from './constants';

export class ZohoCliq extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Zoho Cliq',
			name: 'zohoCliq',
			group: ['output'],
			icon: {
				light: 'file:ZohoCliqNodeIconLight.svg',
				dark: 'file:ZohoCliqNodeIconDark.svg',
			},
			subtitle: SUBTITLE_EXPRESSION,
			description: NODE_DESCRIPTION,
			defaultVersion: 1,
		};

		const nodeVersions: IVersionedNodeType['nodeVersions'] = {
			1: new ZohoCliqV1(),
		};

		super(nodeVersions, baseDescription);
	}
}
