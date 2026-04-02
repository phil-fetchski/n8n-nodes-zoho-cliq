import * as callsMeeting from '../../../../../../nodes/ZohoCliq/v1/actions/callsMeeting/CallsMeeting.resource';

describe('ZohoCliq - CallsMeeting Resource', () => {
	it('should expose expected operations', () => {
		expect(callsMeeting).toHaveProperty('listCallRecordings');
		expect(callsMeeting).toHaveProperty('getRecordingDetails');
	});

	it('should define operation selector for callsMeeting resource', () => {
		const operationProperty = callsMeeting.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['callsMeeting']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('listCallRecordings');
	});

	it('should include renamed recording participants operation in options', () => {
		const operationProperty = callsMeeting.description.find((prop) => prop.name === 'operation');
		const options = (operationProperty?.options ?? []) as Array<{
			name?: string;
			value?: string;
			action?: string;
		}>;
		const participantsOption = options.find((option) => option.value === 'getRecordingDetails');

		expect(participantsOption).toBeDefined();
		expect(participantsOption?.name).toBe('Get Recording Participants & Details');
		expect(participantsOption?.action).toBe('Get recording participants and details');
	});
});
