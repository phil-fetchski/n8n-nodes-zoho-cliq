import * as messageComponentBuilder from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/MessageComponentBuilder.resource';

describe('ZohoCliq - Message Component Builder Resource', () => {
	it('should expose all expected operations', () => {
		expect(messageComponentBuilder).toHaveProperty('buildAgentCardPayload');
		expect(messageComponentBuilder).toHaveProperty('buildCardPayload');
		expect(messageComponentBuilder).toHaveProperty('buildFireAckMessage');
		expect(messageComponentBuilder).toHaveProperty('buildTableComponent');
		expect(messageComponentBuilder).toHaveProperty('buildListComponent');
		expect(messageComponentBuilder).toHaveProperty('buildImageComponent');
		expect(messageComponentBuilder).toHaveProperty('buildLabelComponent');
		expect(messageComponentBuilder).toHaveProperty('buildGraphComponent');
		expect(messageComponentBuilder).toHaveProperty('buildChartComponent');
		expect(messageComponentBuilder).toHaveProperty('buildComponents');
		expect(messageComponentBuilder).toHaveProperty('buildButtons');
	});

	it('should define operation selector for messageComponentBuilder resource', () => {
		const operationProperty = messageComponentBuilder.description.find(
			(property) => property.name === 'operation',
		);

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['messageComponentBuilder']);
		expect(operationProperty?.default).toBe('buildCardPayload');

		const optionValues = ((operationProperty?.options ?? []) as Array<{ value: string }>).map(
			(option) => option.value,
		);
		expect(optionValues).toEqual([
			'buildAgentCardPayload',
			'buildButtons',
			'buildCardPayload',
			'buildFireAckMessage',
			'buildChartComponent',
			'buildComponents',
			'buildGraphComponent',
			'buildImageComponent',
			'buildLabelComponent',
			'buildListComponent',
			'buildTableComponent',
		]);
	});

	it('should not require cardInputMode for builder component inputs', () => {
		const componentsSlides = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'slides' &&
				property.displayOptions?.show?.operation?.includes('buildComponents'),
		);
		const buttonsInput = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'buttons' &&
				property.displayOptions?.show?.operation?.includes('buildButtons'),
		);

		expect(componentsSlides?.displayOptions?.show?.cardInputMode).toBeUndefined();
		expect(buttonsInput?.displayOptions?.show?.cardInputMode).toBeUndefined();
	});

	it('should include wrapper toggles for slides/buttons outputs with default disabled', () => {
		const slidesWrapperToggle = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'includeSlidesWrapper' &&
				property.displayOptions?.show?.operation?.includes('buildComponents'),
		);
		const buttonsWrapperToggle = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'includeButtonsWrapper' &&
				property.displayOptions?.show?.operation?.includes('buildButtons'),
		);

		expect(slidesWrapperToggle?.default).toBe(false);
		expect(buttonsWrapperToggle?.default).toBe(false);
	});

	it('should explain downstream helper outputs in builder notices', () => {
		const chartNotice = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'buildChartComponentNotice' &&
				property.displayOptions?.show?.operation?.includes('buildChartComponent'),
		);
		const buttonsNotice = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'buildButtonsNotice' &&
				property.displayOptions?.show?.operation?.includes('buildButtons'),
		);

		expect(String(chartNotice?.displayName ?? '')).toContain('componentJsonPretty');
		expect(String(buttonsNotice?.displayName ?? '')).toContain('buttonsJsonPretty');
	});

	it('should mention Edit Message in wrapper guidance notices for builder outputs', () => {
		const wrapperNotice = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'wrapperOutputGuidanceNotice' &&
				property.displayOptions?.show?.operation?.includes('buildComponents'),
		);

		expect(String(wrapperNotice?.displayName ?? '')).toContain('Edit Message');
		expect(String(wrapperNotice?.displayName ?? '')).toContain('Schedule Message');
	});

	it('should steer standard component builders to Agent Card Payload Builder for tool use', () => {
		const redirectNotice = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'buildComponentsAgentToolRedirectNotice' &&
				property.displayOptions?.show?.operation?.includes('buildComponents'),
		);

		expect(String(redirectNotice?.displayName ?? '')).toContain('For AI-agent workflows, use');
		expect(String(redirectNotice?.displayName ?? '')).toContain(
			'manual or deterministic workflow assembly',
		);
		expect(String(redirectNotice?.displayName ?? '')).toContain('Agent Card Payload Builder');
	});

	it('should expose the ACK builder guidance and spinner credit notices', () => {
		const guidanceNotice = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'buildFireAckMessageGuidanceNotice' &&
				property.displayOptions?.show?.operation?.includes('buildFireAckMessage'),
		);
		const creditsNotice = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'buildFireAckMessageSpinnerCreditsNotice' &&
				property.displayOptions?.show?.operation?.includes('buildFireAckMessage'),
		);
		const spinnerColor = messageComponentBuilder.description.find(
			(property) =>
				property.name === 'ackSpinnerColor' &&
				property.displayOptions?.show?.operation?.includes('buildFireAckMessage'),
		);

		expect(String(guidanceNotice?.displayName ?? '')).toContain('ack_payload');
		expect(String(creditsNotice?.displayName ?? '')).toContain('icon-sets.iconify.design');
		expect(spinnerColor?.type).toBe('color');
	});
});
