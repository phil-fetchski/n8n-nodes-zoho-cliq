import { createTextSlideProperties } from '../../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload/slideValues/text';

describe('ZohoCliq - Shared - messagePayload - slideValues/text', () => {
	it('should reflect configured max length in text slide description', () => {
		const properties = createTextSlideProperties([], 256);
		const textContent = properties.find((property) => property.name === 'textData');

		expect(textContent).toMatchObject({
			type: 'string',
			description: 'Text slide content (max 256 chars)',
			typeOptions: { rows: 4, maxLength: 256 },
		});
	});

	it('should use fallback max length text when max length is not provided', () => {
		const properties = createTextSlideProperties([], undefined as unknown as number);
		const textContent = properties.find((property) => property.name === 'textData');

		expect(textContent?.description).toBe('Text slide content (max 1000 chars)');
		expect(textContent?.typeOptions?.maxLength).toBe(1000);
	});
});
