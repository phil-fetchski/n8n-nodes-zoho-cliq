import { createSingleComponentOperationModule } from './builders.shared';

const graphComponentOperation = createSingleComponentOperationModule(
	'graph',
	'Graph',
	'buildGraphComponent',
	'Unable to build graph component',
);

export const { description, execute } = graphComponentOperation;
