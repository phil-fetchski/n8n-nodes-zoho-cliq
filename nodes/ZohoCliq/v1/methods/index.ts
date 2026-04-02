/**
 * Export all methods for dynamic options
 */

import type { INodeType } from 'n8n-workflow';
import { listSearch } from './listSearch';
import { resourceMapping } from './resourceMapping';

export { listSearch, resourceMapping };

export const methods: INodeType['methods'] = {
	listSearch,
	resourceMapping,
};
