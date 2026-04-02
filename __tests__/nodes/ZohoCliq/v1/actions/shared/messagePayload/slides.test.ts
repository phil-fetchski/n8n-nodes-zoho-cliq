import type { IExecuteFunctions } from 'n8n-workflow';

import { extractSlides } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload/slides';

function createContext(): IExecuteFunctions {
	return {
		getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
	} as unknown as IExecuteFunctions;
}

describe('ZohoCliq - Shared - messagePayload - slides helper', () => {
	it('should use default options object when omitted', () => {
		const context = createContext();
		const slides = extractSlides(
			context,
			{
				slide: [
					{
						type: 'text',
						textData: 'Hello slide',
					},
				],
			},
			0,
		);

		expect(slides).toEqual([{ type: 'text', data: 'Hello slide' }]);
	});

	it('should reject non-array data for raw images slides', () => {
		const context = createContext();
		expect(() =>
			extractSlides(
				context,
				{
					slide: [
						{
							slideInputMode: 'raw',
							rawSlide: {
								type: 'images',
								data: { url: 'https://example.com/image.png' },
							},
						},
					],
				},
				0,
			),
		).toThrow('slides.slide[0].data must be an array of image URLs');
	});

	it('should accept HTTPS image URLs for raw images slides', () => {
		const context = createContext();
		const slides = extractSlides(
			context,
			{
				slide: [
					{
						slideInputMode: 'raw',
						rawSlide: {
							type: 'images',
							data: ['https://example.com/image.png'],
						},
					},
				],
			},
			0,
		);

		expect(slides).toEqual([
			{
				type: 'images',
				data: ['https://example.com/image.png'],
			},
		]);
	});
});
