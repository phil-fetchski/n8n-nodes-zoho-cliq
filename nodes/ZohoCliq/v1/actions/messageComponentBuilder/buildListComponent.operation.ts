import { createSingleComponentOperationModule } from './builders.shared';

const listComponentOperation = createSingleComponentOperationModule(
	'list',
	'List',
	'buildListComponent',
	'Unable to build list component',
);

export const { description, execute } = listComponentOperation;
