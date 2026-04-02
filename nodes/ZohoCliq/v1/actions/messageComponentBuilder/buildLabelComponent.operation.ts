import { createSingleComponentOperationModule } from './builders.shared';

const labelComponentOperation = createSingleComponentOperationModule(
	'label',
	'Label',
	'buildLabelComponent',
	'Unable to build label component',
);

export const { description, execute } = labelComponentOperation;
