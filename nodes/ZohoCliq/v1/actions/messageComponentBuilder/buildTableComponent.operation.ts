import { createSingleComponentOperationModule } from './builders.shared';

const tableComponentOperation = createSingleComponentOperationModule(
	'table',
	'Table',
	'buildTableComponent',
	'Unable to build table component',
);

export const { description, execute } = tableComponentOperation;
