import type { IExecuteFunctions } from 'n8n-workflow';

import { resolveCardPayload } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';

describe('ZohoCliq - Shared - messagePayload - rich branch coverage', () => {
	it('should require top-level card text in raw mode card payload builder', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'raw';
				if (name === 'richPayloadJson') return { card: { title: 'No text' } };
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		expect(() => resolveCardPayload(context, 0)).toThrow('Card Text is required');
	});

	it('should require top-level card text in structured mode card payload builder', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'structured';
				if (name === 'cardTitle') return 'Card Without Text';
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		expect(() => resolveCardPayload(context, 0)).toThrow('Card Text is required');
	});

	it('should tolerate optional icon parameter lookup failures when icon flags are disabled', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'structured';
				if (name === 'richText') return 'Top level text';
				if (
					name === 'cardIconIconify' ||
					name === 'cardIcon' ||
					name === 'cardThumbnailIconify' ||
					name === 'cardThumbnail'
				) {
					throw new Error('optional parameter unavailable');
				}
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		const payload = resolveCardPayload(context, 0, { requireMessageContent: false });
		expect(payload).toMatchObject({ text: 'Top level text' });
	});

	it('should resolve custom icon and thumbnail when add-card toggles are enabled', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'structured';
				if (name === 'richText') return 'Top level text';
				if (name === 'addCardIcon') return true;
				if (name === 'cardIconInputMode') return 'custom';
				if (name === 'cardIcon') return 'https://cdn.example.com/icon.svg';
				if (name === 'addCardThumbnail') return true;
				if (name === 'cardThumbnailInputMode') return 'custom';
				if (name === 'cardThumbnail') return 'https://cdn.example.com/thumb.svg';
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		const payload = resolveCardPayload(context, 0, { requireMessageContent: false });
		expect(payload.card).toMatchObject({
			icon: 'https://cdn.example.com/icon.svg',
			thumbnail: 'https://cdn.example.com/thumb.svg',
		});
	});

	it('should resolve iconify icon and thumbnail when add-card toggles are enabled', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'structured';
				if (name === 'richText') return 'Top level text';
				if (name === 'addCardIcon') return true;
				if (name === 'cardIconInputMode') return 'iconify';
				if (name === 'cardIconIconify') return 'lucide/alarm-clock';
				if (name === 'addCardThumbnail') return true;
				if (name === 'cardThumbnailInputMode') return 'iconify';
				if (name === 'cardThumbnailIconify') return 'lucide/rocket';
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		const payload = resolveCardPayload(context, 0, { requireMessageContent: false });
		expect(payload.card).toMatchObject({
			icon: 'https://api.iconify.design/lucide/alarm-clock.svg',
			thumbnail: 'https://api.iconify.design/lucide/rocket.svg',
		});
	});

	it('should resolve picker icon and thumbnail when add-card toggles are enabled', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'structured';
				if (name === 'richText') return 'Top level text';
				if (name === 'addCardIcon') return true;
				if (name === 'cardIconInputMode') return 'picker';
				if (name === 'cardIconPicker') return { type: 'icon', value: 'alarm-clock' };
				if (name === 'addCardThumbnail') return true;
				if (name === 'cardThumbnailInputMode') return 'picker';
				if (name === 'cardThumbnailPicker') return { type: 'icon', value: 'rocket' };
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		const payload = resolveCardPayload(context, 0, { requireMessageContent: false });
		expect(payload.card).toMatchObject({
			icon: 'https://api.iconify.design/lucide/alarm-clock.svg',
			thumbnail: 'https://api.iconify.design/lucide/rocket.svg',
		});
	});

	it('should fall back to legacy icon fields when iconify mode has empty values', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'structured';
				if (name === 'richText') return 'Top level text';
				if (name === 'addCardIcon') return true;
				if (name === 'cardIconInputMode') return 'iconify';
				if (name === 'cardIconIconify') return '';
				if (name === 'cardIcon') return 'https://legacy.example.com/icon.svg';
				if (name === 'addCardThumbnail') return true;
				if (name === 'cardThumbnailInputMode') return 'iconify';
				if (name === 'cardThumbnailIconify') return '';
				if (name === 'cardThumbnail') return 'https://legacy.example.com/thumb.svg';
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		const payload = resolveCardPayload(context, 0, { requireMessageContent: false });
		expect(payload.card).toMatchObject({
			icon: 'https://legacy.example.com/icon.svg',
			thumbnail: 'https://legacy.example.com/thumb.svg',
		});
	});

	it('should normalize null optional iconify values to undefined when icon toggles are disabled', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'structured';
				if (name === 'richText') return 'Top level text';
				if (name === 'cardIconIconify') return null;
				if (name === 'cardThumbnailIconify') return null;
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		const payload = resolveCardPayload(context, 0, { requireMessageContent: false });
		expect(payload).toMatchObject({ text: 'Top level text' });
	});

	it('should evaluate optional iconify fallback branch when custom icon mode is selected', () => {
		const context = {
			getNode: jest.fn(() => ({ name: 'Test Node' })),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'cardInputMode') return 'structured';
				if (name === 'richText') return 'Top level text';
				if (name === 'addCardIcon') return true;
				if (name === 'cardIconInputMode') return 'custom';
				if (name === 'cardIcon') return 'https://cdn.example.com/icon.svg';
				if (name === 'cardIconIconify') return null;
				if (name === 'addCardThumbnail') return true;
				if (name === 'cardThumbnailInputMode') return 'custom';
				if (name === 'cardThumbnail') return 'https://cdn.example.com/thumb.svg';
				if (name === 'cardThumbnailIconify') return null;
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		const payload = resolveCardPayload(context, 0, { requireMessageContent: false });
		expect(payload.card).toMatchObject({
			icon: 'https://cdn.example.com/icon.svg',
			thumbnail: 'https://cdn.example.com/thumb.svg',
		});
	});
});
