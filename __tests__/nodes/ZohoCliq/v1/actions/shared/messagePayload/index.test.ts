import * as messagePayload from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';
import { createContext } from './testUtils';

describe('ZohoCliq - Shared - messagePayload - index exports', () => {
	it('should expose and route core re-exported helpers', () => {
		expect(Array.isArray(messagePayload.messagePayloadDescription)).toBe(true);
		expect(Array.isArray(messagePayload.cardPayloadBuilderDescription)).toBe(true);

		const textContext = createContext({
			messageType: 'text',
			text: 'hello world',
			postAsBot: false,
		});
		const textPayload = messagePayload.resolveMessagePayload(textContext, 0);
		expect(textPayload).toEqual({ text: 'hello world' });

		const cardContext = createContext({
			cardInputMode: 'structured',
			richText: 'card text',
		});
		const cardPayload = messagePayload.resolveCardPayload(cardContext, 0, {
			requireMessageContent: false,
		});
		expect(cardPayload).toEqual({ text: 'card text' });

		const botParam = messagePayload.resolveBotUniqueNameQueryParam(textContext, 0);
		expect(botParam).toBeUndefined();
	});
});
