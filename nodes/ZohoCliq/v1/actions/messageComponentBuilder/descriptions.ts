import type { INodeProperties, INodePropertyCollection } from 'n8n-workflow';

import { messagePayloadDescription } from '../shared/messagePayload';

export type BuilderComponentType =
	| 'table'
	| 'list'
	| 'images'
	| 'label'
	| 'graph'
	| 'percentage_chart';

function deepCloneProperty<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function stripMessageBuilderIncompatibleDisplayOptions(property: INodeProperties): INodeProperties {
	const cloned = deepCloneProperty(property);
	const showOptions = cloned.displayOptions?.show;
	if (!showOptions) {
		return cloned;
	}

	delete (showOptions as Record<string, unknown>).messageType;
	delete (showOptions as Record<string, unknown>).cardInputMode;
	const hasShowKeysRemaining = Object.keys(showOptions).length > 0;
	/* c8 ignore next */
	/* istanbul ignore next */
	if (!hasShowKeysRemaining) {
		delete cloned.displayOptions;
	}

	return cloned;
}

function requireMessagePayloadProperty(name: string): INodeProperties {
	const property = messagePayloadDescription.find((entry) => entry.name === name);
	if (!property) {
		throw new Error(`Unable to find shared message payload property: ${name}`);
	}

	return stripMessageBuilderIncompatibleDisplayOptions(property);
}

function constrainSlideTypeOptions(
	slidesProperty: INodeProperties,
	componentType: BuilderComponentType,
	componentLabel: string,
): INodeProperties {
	const cloned = deepCloneProperty(slidesProperty);
	/* c8 ignore next */
	/* istanbul ignore next */
	const optionEntries = Array.isArray(cloned.options) ? cloned.options : [];
	const slideOption = optionEntries.find((entry) => entry.name === 'slide');
	if (!slideOption || !('values' in slideOption)) {
		throw new Error('Shared slides property does not contain slide collection values');
	}

	const slideCollectionOption = slideOption as INodePropertyCollection;
	/* c8 ignore next */
	/* istanbul ignore next */
	const slideValues = Array.isArray(slideCollectionOption.values)
		? slideCollectionOption.values
		: [];
	slideCollectionOption.values = slideValues.map((value) => {
		if (value.name !== 'type') {
			return value;
		}

		return {
			...value,
			options: [{ name: componentLabel, value: componentType }],
			default: componentType,
		};
	});

	return cloned;
}

export const __testHelpers = Object.freeze({
	stripMessageBuilderIncompatibleDisplayOptions,
	constrainSlideTypeOptions,
});

export function createSingleComponentSlidesProperty(
	componentType: BuilderComponentType,
	componentLabel: string,
): INodeProperties {
	const slidesProperty = requireMessagePayloadProperty('slides');
	const constrainedSlides = constrainSlideTypeOptions(
		slidesProperty,
		componentType,
		componentLabel,
	);

	return {
		...constrainedSlides,
		displayName: `${componentLabel} Component`,
		description: `Build one ${componentLabel.toLowerCase()} component object (no slides wrapper)`,
		placeholder: `Add ${componentLabel} Component`,
	};
}

export function createMultiComponentSlidesProperty(): INodeProperties {
	const slidesProperty = requireMessagePayloadProperty('slides');
	return {
		...slidesProperty,
		displayName: 'Components',
		description: 'Build one or more component objects (no slides wrapper)',
		placeholder: 'Add Component',
	};
}

export function createButtonsProperty(): INodeProperties {
	const buttonsProperty = requireMessagePayloadProperty('buttons');
	return {
		...buttonsProperty,
		displayName: 'Buttons',
		description: 'Build one or more button objects (no buttons wrapper)',
		placeholder: 'Add Button',
	};
}
