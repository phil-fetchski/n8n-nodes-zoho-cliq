/**
 * Message Component Builder resource
 * Builds reusable card, component, and button payloads locally (no API call)
 */

import type { INodeProperties } from 'n8n-workflow';

import * as buildAgentCardPayload from './buildAgentCardPayload.operation';
import * as buildButtons from './buildButtons.operation';
import * as buildCardPayload from './buildCardPayload.operation';
import * as buildChartComponent from './buildChartComponent.operation';
import * as buildComponents from './buildComponents.operation';
import * as buildFireAckMessage from './buildFireAckMessage.operation';
import * as buildGraphComponent from './buildGraphComponent.operation';
import * as buildImageComponent from './buildImageComponent.operation';
import * as buildLabelComponent from './buildLabelComponent.operation';
import * as buildListComponent from './buildListComponent.operation';
import * as buildTableComponent from './buildTableComponent.operation';

export {
	buildAgentCardPayload,
	buildButtons,
	buildCardPayload,
	buildChartComponent,
	buildComponents,
	buildFireAckMessage,
	buildGraphComponent,
	buildImageComponent,
	buildLabelComponent,
	buildListComponent,
	buildTableComponent,
};

type MessageComponentBuilderOperationValue =
	| 'buildAgentCardPayload'
	| 'buildButtons'
	| 'buildCardPayload'
	| 'buildChartComponent'
	| 'buildComponents'
	| 'buildFireAckMessage'
	| 'buildGraphComponent'
	| 'buildImageComponent'
	| 'buildLabelComponent'
	| 'buildListComponent'
	| 'buildTableComponent';

type MessageComponentBuilderOperationRegistryEntry = {
	name: string;
	value: MessageComponentBuilderOperationValue;
	description: string;
	action: string;
	operation: { description: INodeProperties[] };
};

const operationRegistry: MessageComponentBuilderOperationRegistryEntry[] = [
	{
		name: 'Agent Card Payload Builder',
		value: 'buildAgentCardPayload',
		description:
			'Build a validated rich message payload object for AI-agent workflows (no API call)',
		action: 'Build an agent-ready card payload',
		operation: buildAgentCardPayload,
	},
	{
		name: 'Build Buttons',
		value: 'buildButtons',
		description: 'Build one or more button objects (no API call)',
		action: 'Build buttons',
		operation: buildButtons,
	},
	{
		name: 'Build Card Payload',
		value: 'buildCardPayload',
		description: 'Build a reusable rich card payload (no API call)',
		action: 'Build a card payload',
		operation: buildCardPayload,
	},
	{
		name: 'Build/Fire ACK Message',
		value: 'buildFireAckMessage',
		description:
			'Build an immediate loading-state ACK payload and optionally send it to a bot with sync_message forced on',
		action: 'Build and fire an ACK message',
		operation: buildFireAckMessage,
	},
	{
		name: 'Build Chart Component',
		value: 'buildChartComponent',
		description: 'Build a single chart component object (no API call)',
		action: 'Build a chart component',
		operation: buildChartComponent,
	},
	{
		name: 'Build Components',
		value: 'buildComponents',
		description: 'Build one or more component objects (no API call)',
		action: 'Build components',
		operation: buildComponents,
	},
	{
		name: 'Build Graph Component',
		value: 'buildGraphComponent',
		description: 'Build a single graph component object (no API call)',
		action: 'Build a graph component',
		operation: buildGraphComponent,
	},
	{
		name: 'Build Image Component',
		value: 'buildImageComponent',
		description: 'Build a single image component object (no API call)',
		action: 'Build an image component',
		operation: buildImageComponent,
	},
	{
		name: 'Build Label Component',
		value: 'buildLabelComponent',
		description: 'Build a single label component object (no API call)',
		action: 'Build a label component',
		operation: buildLabelComponent,
	},
	{
		name: 'Build List Component',
		value: 'buildListComponent',
		description: 'Build a single list component object (no API call)',
		action: 'Build a list component',
		operation: buildListComponent,
	},
	{
		name: 'Build Table Component',
		value: 'buildTableComponent',
		description: 'Build a single table component object (no API call)',
		action: 'Build a table component',
		operation: buildTableComponent,
	},
];

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['messageComponentBuilder'],
			},
		},
		options: operationRegistry.map((entry) => ({
			name: entry.name,
			value: entry.value,
			description: entry.description,
			action: entry.action,
		})),
		default: 'buildCardPayload',
	},
	...operationRegistry.flatMap((entry) => entry.operation.description),
];
