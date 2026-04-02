import { createSingleComponentOperationModule } from './builders.shared';

const imageComponentOperation = createSingleComponentOperationModule(
	'images',
	'Image',
	'buildImageComponent',
	'Unable to build image component',
);

export const { description, execute } = imageComponentOperation;
