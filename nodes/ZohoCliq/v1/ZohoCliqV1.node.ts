/**
 * Zoho Cliq Node - Modular Architecture
 */

import type { IExecuteFunctions, INodeType, INodeTypeDescription } from 'n8n-workflow';

import { router } from './actions/router';
import { versionDescription } from './actions/versionDescription';
import { listSearch, resourceMapping } from './methods';

export class ZohoCliqV1 implements INodeType {
	description: INodeTypeDescription = {
		...versionDescription,
		icon: {
			light: 'file:ZohoCliqNodeIconLight.svg',
			dark: 'file:ZohoCliqNodeIconDark.svg',
		},
		usableAsTool: true,
	};

	methods = { listSearch, resourceMapping };

	async execute(this: IExecuteFunctions) {
		return await router.call(this);
	}
}
