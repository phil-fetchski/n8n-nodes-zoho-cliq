import {
	getFirstString,
	hasNotFoundSignal,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/utils';

describe('ZohoCliq - Shared Preflight utils', () => {
	it('should return the first trimmed string or numeric value', () => {
		expect(getFirstString('  value  ')).toBe('value');
		expect(getFirstString(['', '  second  ', 123])).toBe('second');
		expect(getFirstString(BigInt(123))).toBe('123');
	});

	it('should convert plain numbers to strings', () => {
		expect(getFirstString(123)).toBe('123');
		expect(getFirstString(0)).toBe('0');
		expect(getFirstString([null, 42])).toBe('42');
	});

	it('should return undefined when no supported string-like value exists', () => {
		expect(getFirstString([null, undefined, {}, []])).toBeUndefined();
	});

	it('should classify default not-found status codes from nested response metadata', () => {
		expect(
			hasNotFoundSignal(
				{
					response: {
						status: '404',
					},
				},
				{
					messageFragments: ['not found'],
				},
			),
		).toBe(true);
	});

	it('should return false when a recognized integer status code is not in the allowed set', () => {
		expect(
			hasNotFoundSignal(
				{
					statusCode: 401,
				},
				{
					messageFragments: ['not found'],
				},
			),
		).toBe(false);
	});

	it('should honor custom not-found status code sets', () => {
		expect(
			hasNotFoundSignal(
				{
					httpCode: 410,
				},
				{
					messageFragments: ['not found'],
					statusCodes: new Set([410]),
				},
			),
		).toBe(true);
	});

	it('should detect not-found fragments from nested response payload text', () => {
		expect(
			hasNotFoundSignal(
				{
					response: {
						body: {
							description: 'The requested team does not exist',
						},
					},
				},
				{
					messageFragments: ['does not exist'],
				},
			),
		).toBe(true);
	});
});
