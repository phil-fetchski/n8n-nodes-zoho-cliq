import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	validateHistoryFilter,
	validateMediaSessionId,
	validateMediaSessionType,
	validateMediaSessionTypes,
	validateNumericId,
	validateNumericIdList,
	validateParticipantsFilter,
	validateSearchTerm,
	validateTimestampParam,
} from '../../../../../../nodes/ZohoCliq/v1/actions/callsMeeting/common';

describe('ZohoCliq - CallsMeeting - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	describe('validateMediaSessionId', () => {
		it('should trim and return valid session ID', () => {
			const result = validateMediaSessionId(mockExecuteFunctions, '  MS_123-abc  ', 0);
			expect(result).toBe('MS_123-abc');
		});

		it('should throw for empty session ID', () => {
			expect(() => validateMediaSessionId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for invalid session ID format', () => {
			expect(() => validateMediaSessionId(mockExecuteFunctions, 'MS/123', 0)).toThrow(
				'Invalid Media Session ID format',
			);
		});

		it('should throw for session ID longer than 200 chars', () => {
			expect(() => validateMediaSessionId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				'Media Session ID is too long',
			);
		});
	});

	describe('validateMediaSessionType', () => {
		it('should allow known types', () => {
			const result = validateMediaSessionType(mockExecuteFunctions, 'video_conference', 0);
			expect(result).toBe('video_conference');
		});

		it('should throw for empty type', () => {
			expect(() => validateMediaSessionType(mockExecuteFunctions, '', 0)).toThrow(
				'Type must not be empty',
			);
		});

		it('should throw for unknown type', () => {
			expect(() => validateMediaSessionType(mockExecuteFunctions, 'video', 0)).toThrow(
				'Type must be one of',
			);
		});
	});

	describe('validateMediaSessionTypes', () => {
		it('should join and de-duplicate valid types', () => {
			const result = validateMediaSessionTypes(
				mockExecuteFunctions,
				['video_conference', 'assembly', 'video_conference'],
				0,
			);
			expect(result).toBe('video_conference,assembly');
		});

		it('should throw when all is combined with other types', () => {
			expect(() =>
				validateMediaSessionTypes(mockExecuteFunctions, ['all', 'video_conference'], 0),
			).toThrow('Type "all" cannot be combined with any other type');
		});

		it('should throw when direct_call is combined with other types', () => {
			expect(() =>
				validateMediaSessionTypes(mockExecuteFunctions, ['direct_call', 'assembly'], 0),
			).toThrow('Type "direct_call" cannot be combined with any other type');
		});

		it('should return undefined for null value', () => {
			expect(validateMediaSessionTypes(mockExecuteFunctions, null, 0)).toBeUndefined();
		});

		it('should return undefined for comma string with only empty values', () => {
			expect(validateMediaSessionTypes(mockExecuteFunctions, ' ,  , ', 0)).toBeUndefined();
		});

		it('should parse and join comma-separated string values', () => {
			const result = validateMediaSessionTypes(
				mockExecuteFunctions,
				' video_conference , assembly ',
				0,
			);
			expect(result).toBe('video_conference,assembly');
		});
	});

	describe('validateHistoryFilter', () => {
		it('should accept supported filters', () => {
			expect(validateHistoryFilter(mockExecuteFunctions, 'viewed', 0)).toBe('viewed');
		});

		it('should reject empty filters', () => {
			expect(() => validateHistoryFilter(mockExecuteFunctions, '   ', 0)).toThrow(
				'Filter must not be empty',
			);
		});

		it('should reject unsupported filters', () => {
			expect(() => validateHistoryFilter(mockExecuteFunctions, 'invalid', 0)).toThrow(
				'Filter must be one of',
			);
		});
	});

	describe('validateParticipantsFilter', () => {
		it('should accept supported filters', () => {
			expect(validateParticipantsFilter(mockExecuteFunctions, 'invited', 0)).toBe('invited');
		});

		it('should reject empty filters', () => {
			expect(() => validateParticipantsFilter(mockExecuteFunctions, '   ', 0)).toThrow(
				'Filter must not be empty',
			);
		});

		it('should reject unsupported filters', () => {
			expect(() => validateParticipantsFilter(mockExecuteFunctions, 'inactive', 0)).toThrow(
				'Filter must be one of',
			);
		});
	});

	describe('validateTimestampParam', () => {
		it('should accept non-negative whole-number timestamps', () => {
			expect(validateTimestampParam(mockExecuteFunctions, 1700000000000, 'From Time', 0)).toBe(
				1700000000000,
			);
		});

		it('should reject non-whole-number timestamps', () => {
			expect(() => validateTimestampParam(mockExecuteFunctions, 1.5, 'From Time', 0)).toThrow(
				'From Time must be a non-negative timestamp in milliseconds',
			);
		});

		it('should reject non-numeric timestamps', () => {
			expect(() =>
				validateTimestampParam(mockExecuteFunctions, 'not-a-number', 'From Time', 0),
			).toThrow('From Time must be a non-negative timestamp in milliseconds');
		});

		it('should reject negative timestamps', () => {
			expect(() => validateTimestampParam(mockExecuteFunctions, -1, 'From Time', 0)).toThrow(
				'From Time must be a non-negative timestamp in milliseconds',
			);
		});
	});

	describe('validateNumericId', () => {
		it('should accept numeric ID strings', () => {
			expect(validateNumericId(mockExecuteFunctions, ' 62440502 ', 'Host ID', 0)).toBe('62440502');
		});

		it('should reject empty IDs', () => {
			expect(() => validateNumericId(mockExecuteFunctions, '   ', 'Host ID', 0)).toThrow(
				'Host ID cannot be empty',
			);
		});

		it('should reject non-numeric IDs', () => {
			expect(() => validateNumericId(mockExecuteFunctions, '624a', 'Host ID', 0)).toThrow(
				'Host ID must contain only digits',
			);
		});

		it('should reject IDs longer than 30 characters', () => {
			expect(() => validateNumericId(mockExecuteFunctions, '1'.repeat(31), 'Host ID', 0)).toThrow(
				'Host ID is too long',
			);
		});
	});

	describe('validateNumericIdList', () => {
		it('should parse and deduplicate numeric ID list', () => {
			expect(validateNumericIdList(mockExecuteFunctions, '1,2,2,3', 'Recipient IDs', 0)).toBe(
				'1,2,3',
			);
		});

		it('should reject empty numeric ID list', () => {
			expect(() => validateNumericIdList(mockExecuteFunctions, ' , ', 'Recipient IDs', 0)).toThrow(
				'Recipient IDs cannot be empty',
			);
		});
	});

	describe('validateSearchTerm', () => {
		it('should trim and return valid search term', () => {
			expect(validateSearchTerm(mockExecuteFunctions, '  team sync  ', 0)).toBe('team sync');
		});

		it('should reject empty search term', () => {
			expect(() => validateSearchTerm(mockExecuteFunctions, '   ', 0)).toThrow(
				'Search cannot be empty',
			);
		});

		it('should reject search term longer than 200 chars', () => {
			expect(() => validateSearchTerm(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				'Search is too long. Maximum length is 200 characters.',
			);
		});
	});
});
