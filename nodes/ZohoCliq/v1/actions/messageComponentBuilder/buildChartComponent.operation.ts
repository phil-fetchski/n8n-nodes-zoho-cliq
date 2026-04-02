import { createSingleComponentOperationModule } from './builders.shared';

const chartComponentOperation = createSingleComponentOperationModule(
	'percentage_chart',
	'Chart',
	'buildChartComponent',
	'Unable to build chart component',
);

export const { description, execute } = chartComponentOperation;
