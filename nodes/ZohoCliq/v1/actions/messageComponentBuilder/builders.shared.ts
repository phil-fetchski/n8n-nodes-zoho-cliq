import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { extractButtons } from '../shared/messagePayload/buttons';
import { extractSlides } from '../shared/messagePayload/slides';
import {
	appendExecutionData,
	appendOperationError,
	applyResourceDisplayOptions,
	createAgentToolRedirectNotice,
	toPrettyAndStringPayload,
} from './common';
import {
	type BuilderComponentType,
	createButtonsProperty,
	createMultiComponentSlidesProperty,
	createSingleComponentSlidesProperty,
} from './descriptions';

const rawJsonWrapperGuidanceNotice: INodeProperties = {
	displayName:
		'Wrapper Output Guidance: Enable this only when composing messages in Post Message, Edit Message, or Schedule Message using <b>Advanced (JSON)</b> mode / JSON code editor. Keep it disabled when reusing the machine-friendly object outputs directly in expressions.',
	name: 'wrapperOutputGuidanceNotice',
	type: 'notice',
	default: '',
};

const includeSlidesWrapperToggle: INodeProperties = {
	displayName: 'Include Slides Wrapper in Output',
	name: 'includeSlidesWrapper',
	type: 'boolean',
	default: false,
	description:
		'Whether to include a "slides": [...] wrapper snippet for raw JSON editor usage in downstream message tools',
};

const includeButtonsWrapperToggle: INodeProperties = {
	displayName: 'Include Buttons Wrapper in Output',
	name: 'includeButtonsWrapper',
	type: 'boolean',
	default: false,
	description:
		'Whether to include a "buttons": [...] wrapper snippet for raw JSON editor usage in downstream message tools',
};

function createSingleComponentProperties(
	componentLabel: string,
	operationName: string,
): INodeProperties[] {
	return applyResourceDisplayOptions(
		[
			{
				displayName: `Build one validated ${componentLabel.toLowerCase()} component object. This operation does not send a message. Reuse <code>{{$json.componentJsonPretty}}</code> as one slide/component entry in a larger slides array, or use <code>{{$json.componentPayload}}</code> in expression-driven raw JSON assembly.`,
				name: `${operationName}Notice`,
				type: 'notice',
				default: '',
			},
		],
		operationName,
	);
}

export function createSingleComponentDescription(
	componentType: BuilderComponentType,
	componentLabel: string,
	operationName: string,
): INodeProperties[] {
	const properties: INodeProperties[] = [
		...createSingleComponentProperties(componentLabel, operationName),
		createSingleComponentSlidesProperty(componentType, componentLabel),
		includeSlidesWrapperToggle,
		{
			...rawJsonWrapperGuidanceNotice,
			displayOptions: {
				show: {
					includeSlidesWrapper: [true],
				},
			},
		},
		createAgentToolRedirectNotice(`${operationName}AgentToolRedirectNotice`),
	];
	return applyResourceDisplayOptions(properties, operationName);
}

export function createSingleComponentOperationModule(
	componentType: BuilderComponentType,
	componentLabel: string,
	builderName: string,
	fallbackMessage: string,
): {
	description: INodeProperties[];
	execute: (
		this: IExecuteFunctions,
		items: INodeExecutionData[],
		grantedScopes: string,
	) => Promise<INodeExecutionData[]>;
} {
	return {
		description: createSingleComponentDescription(componentType, componentLabel, builderName),
		async execute(
			this: IExecuteFunctions,
			items: INodeExecutionData[],
			_grantedScopes: string,
		): Promise<INodeExecutionData[]> {
			void _grantedScopes;
			return executeSingleComponentBuilder.call(
				this,
				items,
				componentType,
				builderName,
				fallbackMessage,
			);
		},
	};
}

export function createMultiComponentDescription(operationName: string): INodeProperties[] {
	const properties: INodeProperties[] = [
		{
			displayName:
				'Build one or more reusable component objects. This operation does not send a message. Reuse <code>{{$json.componentsJsonPretty}}</code> as slides array entries, or use <code>{{$json.componentsPayload}}</code> / <code>{{$json.componentsCsv}}</code> when assembling raw JSON payloads manually.',
			name: 'buildComponentsNotice',
			type: 'notice',
			default: '',
		},
		createMultiComponentSlidesProperty(),
		includeSlidesWrapperToggle,
		{
			...rawJsonWrapperGuidanceNotice,
			displayOptions: {
				show: {
					includeSlidesWrapper: [true],
				},
			},
		},
		createAgentToolRedirectNotice(`${operationName}AgentToolRedirectNotice`),
	];
	return applyResourceDisplayOptions(properties, operationName);
}

export function createButtonsDescription(operationName: string): INodeProperties[] {
	const properties: INodeProperties[] = [
		{
			displayName:
				"Build one or more reusable button objects. This operation does not send a message. Reuse <code>{{$json.buttonsJsonPretty}}</code> as top-level card buttons or inside one slide's <code>buttons</code> array, or use <code>{{$json.buttonsPayload}}</code> when assembling raw JSON payloads manually.",
			name: 'buildButtonsNotice',
			type: 'notice',
			default: '',
		},
		createButtonsProperty(),
		includeButtonsWrapperToggle,
		{
			...rawJsonWrapperGuidanceNotice,
			displayOptions: {
				show: {
					includeButtonsWrapper: [true],
				},
			},
		},
		createAgentToolRedirectNotice(`${operationName}AgentToolRedirectNotice`),
	];
	return applyResourceDisplayOptions(properties, operationName);
}

export async function executeSingleComponentBuilder(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	componentType: BuilderComponentType,
	operationName: string,
	fallbackMessage: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const slidesValue = this.getNodeParameter('slides', i, {}) as unknown;
			const components = extractSlides(this, slidesValue, i, { autoGenerateButtonKey: false });

			if (components.length !== 1) {
				throw new NodeOperationError(this.getNode(), 'Exactly one component is required', {
					itemIndex: i,
				});
			}

			const component = components[0];
			if (component.type !== componentType) {
				throw new NodeOperationError(
					this.getNode(),
					`Component type must be "${componentType}" for this builder operation`,
					{ itemIndex: i },
				);
			}

			const payload = toPrettyAndStringPayload(component);
			const output: IDataObject = {
				componentType,
				componentJsonPretty: payload.pretty,
				componentPayload: payload.payload,
			};
			const includeSlidesWrapperRaw = this.getNodeParameter('includeSlidesWrapper', i, false);
			const includeSlidesWrapper = includeSlidesWrapperRaw ?? false;
			if (typeof includeSlidesWrapper !== 'boolean') {
				throw new NodeOperationError(this.getNode(), 'includeSlidesWrapper must be a boolean', {
					itemIndex: i,
				});
			}
			if (includeSlidesWrapper) {
				output.wrapperPrefixPayload = `"slides": ${JSON.stringify([component], null, 2)}`;
			}
			appendExecutionData(this, returnData, i, output);
		} catch (error) {
			appendOperationError(this, returnData, i, error, {
				fallbackMessage,
				operation: operationName,
			});
		}
	}

	return returnData;
}

export async function executeMultiComponentBuilder(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const slidesValue = this.getNodeParameter('slides', i, {}) as unknown;
			const components = extractSlides(this, slidesValue, i, { autoGenerateButtonKey: false });

			if (components.length === 0) {
				throw new NodeOperationError(this.getNode(), 'At least one component is required', {
					itemIndex: i,
				});
			}

			const output: IDataObject = {
				componentsJsonPretty: components,
				componentsPayload: JSON.stringify(components, null, 2),
				componentsCsv: components.map((entry) => JSON.stringify(entry)).join(',\n'),
			};
			const includeSlidesWrapperRaw = this.getNodeParameter('includeSlidesWrapper', i, false);
			const includeSlidesWrapper = includeSlidesWrapperRaw ?? false;
			if (typeof includeSlidesWrapper !== 'boolean') {
				throw new NodeOperationError(this.getNode(), 'includeSlidesWrapper must be a boolean', {
					itemIndex: i,
				});
			}
			if (includeSlidesWrapper) {
				output.wrapperPrefixPayload = `"slides": ${JSON.stringify(components, null, 2)}`;
			}
			appendExecutionData(this, returnData, i, output);
		} catch (error) {
			appendOperationError(this, returnData, i, error, {
				fallbackMessage: 'Unable to build component payload',
				operation: 'buildComponents',
			});
		}
	}

	return returnData;
}

export async function executeButtonsBuilder(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const buttonsValue = this.getNodeParameter('buttons', i, {}) as unknown;
			const buttons = extractButtons(this, buttonsValue, i, { autoGenerateButtonKey: false });
			if (buttons.length === 0) {
				throw new NodeOperationError(this.getNode(), 'At least one button is required', {
					itemIndex: i,
				});
			}

			const payload = toPrettyAndStringPayload(buttons as IDataObject[]);
			const output: IDataObject = {
				buttonsJsonPretty: payload.pretty,
				buttonsPayload: payload.payload,
			};
			const includeButtonsWrapperRaw = this.getNodeParameter('includeButtonsWrapper', i, false);
			const includeButtonsWrapper = includeButtonsWrapperRaw ?? false;
			if (typeof includeButtonsWrapper !== 'boolean') {
				throw new NodeOperationError(this.getNode(), 'includeButtonsWrapper must be a boolean', {
					itemIndex: i,
				});
			}
			if (includeButtonsWrapper) {
				output.wrapperPrefixPayload = `"buttons": ${JSON.stringify(buttons, null, 2)}`;
			}
			appendExecutionData(this, returnData, i, output);
		} catch (error) {
			appendOperationError(this, returnData, i, error, {
				fallbackMessage: 'Unable to build button payload',
				operation: 'buildButtons',
			});
		}
	}

	return returnData;
}
