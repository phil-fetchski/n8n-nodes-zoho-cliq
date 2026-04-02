/**
 * Tests for List Search Methods
 * Verifies resource loaders for searchable dropdowns
 */

import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { listSearch } from '../../../../nodes/ZohoCliq/v1/methods/listSearch';
import * as transport from '../../../../nodes/ZohoCliq/v1/transport';

// Mock transport layer
jest.mock('../../../../nodes/ZohoCliq/v1/transport');

describe('ListSearch Methods', () => {
	let mockLoadOptionsFunctions: ILoadOptionsFunctions;

	beforeEach(() => {
		mockLoadOptionsFunctions = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {},
		} as unknown as ILoadOptionsFunctions;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('searchChannels', () => {
		it('should return list of channels', async () => {
			const mockResponse = {
				channels: [
					{ channel_id: 'C1', name: 'General', unique_name: 'general' },
					{ channel_id: 'C2', name: 'Random', unique_name: 'random' },
				],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toEqual({
				name: 'General',
				value: 'C1',
			});
			expect(result.results[1]).toEqual({
				name: 'Random',
				value: 'C2',
			});
		});

		it('should make API request with correct parameters', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ channels: [] });

			await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/channels',
				{},
				{ limit: 100 },
			);
		});

		it('should filter channels by search term', async () => {
			const mockResponse = {
				channels: [
					{ channel_id: 'C1', name: 'General Discussion', unique_name: 'general' },
					{ channel_id: 'C2', name: 'Random', unique_name: 'random' },
					{ channel_id: 'C3', name: 'Development', unique_name: 'dev' },
				],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions, 'dev');

			expect(result.results).toHaveLength(1);
			expect(result.results[0].name).toBe('Development');
		});

		it('should filter by channel name (case insensitive)', async () => {
			const mockResponse = {
				channels: [
					{ channel_id: 'C1', name: 'General', unique_name: 'general' },
					{ channel_id: 'C2', name: 'RANDOM', unique_name: 'random' },
				],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions, 'GENERAL');

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('C1');
		});

		it('should filter by unique_name', async () => {
			const mockResponse = {
				channels: [
					{ channel_id: 'C1', name: 'General', unique_name: 'general-chat' },
					{ channel_id: 'C2', name: 'Random', unique_name: 'random' },
				],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions, 'chat');

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('C1');
		});

		it('should handle channels without unique_name when filtering', async () => {
			const mockResponse = {
				channels: [
					{ channel_id: 'C1', name: 'General' }, // No unique_name
					{ channel_id: 'C2', name: 'Development', unique_name: 'dev-team' },
				],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			// Search for 'general' - should match by name only since unique_name is undefined
			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions, 'general');

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('C1');
			expect(result.results[0].name).toBe('General');
		});

		it('should return empty results when no channels match', async () => {
			const mockResponse = {
				channels: [{ channel_id: 'C1', name: 'General', unique_name: 'general' }],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions, 'nonexistent');

			expect(result.results).toHaveLength(0);
		});

		it('should use channel_id as fallback name', async () => {
			const mockResponse = {
				channels: [{ channel_id: 'C1' }],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(result.results[0].name).toBe('C1');
		});

		it('should use unique_name as fallback when name is missing', async () => {
			const mockResponse = {
				channels: [{ channel_id: 'C1', unique_name: 'test-channel' }],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(result.results[0].name).toBe('test-channel');
		});

		it('should handle response without channels property', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({});

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(0);
		});

		it('should handle API errors gracefully', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(0);
		});

		it('should return empty results on authentication error', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('Unauthorized'));

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should not throw error on network failure', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('Network error'));

			await expect(listSearch.searchChannels.call(mockLoadOptionsFunctions)).resolves.toEqual({
				results: [],
			});
		});

		it('should handle large channel lists', async () => {
			const channels = Array.from({ length: 100 }, (_, i) => ({
				channel_id: `C${i}`,
				name: `Channel ${i}`,
				unique_name: `channel-${i}`,
			}));

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ channels });

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(100);
		});

		it('should filter correctly with partial matches', async () => {
			const mockResponse = {
				channels: [
					{ channel_id: 'C1', name: 'Development Team', unique_name: 'dev-team' },
					{ channel_id: 'C2', name: 'DevOps', unique_name: 'devops' },
					{ channel_id: 'C3', name: 'Marketing', unique_name: 'marketing' },
				],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions, 'dev');

			expect(result.results).toHaveLength(2);
			expect(result.results.map((r) => r.value)).toEqual(['C1', 'C2']);
		});

		it('should handle channels with missing unique_name', async () => {
			const mockResponse = {
				channels: [{ channel_id: 'C1', name: 'Test Channel' }],
			};

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			const result = await listSearch.searchChannels.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0].name).toBe('Test Channel');
		});
	});

	describe('searchDepartments', () => {
		it('should return list of departments', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				departments: [
					{ department_id: 'D1', name: 'Engineering' },
					{ department_id: 'D2', name: 'Operations' },
				],
			});

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/departments',
				{},
				{ limit: 100 },
			);
			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toEqual({
				name: 'Engineering',
				value: 'D1',
			});
		});

		it('should filter departments by id or name', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				departments: [
					{ department_id: 'D1', name: 'Engineering' },
					{ department_id: 'HR_1', name: 'People Ops' },
				],
			});

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions, 'hr');

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('HR_1');
		});

		it('should handle API errors gracefully', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should parse departments when response shape is data.departments', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					departments: [{ id: 42, display_name: 'Quality Assurance' }],
				},
			});

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'Quality Assurance',
				value: '42',
			});
		});

		it('should parse departments when response shape is data array', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				url: '/api/v2/departments',
				data: [
					{
						id: '5452022000003511003',
						name: 'Glencadia Projects',
					},
				],
			});

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'Glencadia Projects',
				value: '5452022000003511003',
			});
		});

		it('should skip departments that do not contain any supported id field', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				departments: [{ name: 'No ID Department' }, { id: 'D2', name: 'Operations' }],
			});

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('D2');
		});

		it('should return empty results when data object has no departments array', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: { departments: 'not-an-array' },
			});

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should use displayName as department name fallback when name fields are absent', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				departments: [{ id: 'D3', displayName: 'Field Ops' }],
			});

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'Field Ops',
				value: 'D3',
			});
		});

		it('should use department id as name fallback when no name fields exist', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				departments: [{ id: 'D4' }],
			});

			const result = await listSearch.searchDepartments.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'D4',
				value: 'D4',
			});
		});
	});

	describe('searchUserFields', () => {
		it('should return list of user fields from response.list', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				url: '/api/v2/userfields',
				list: [
					{ id: '1901', name: 'Vaccinated', unique_name: 'vaccinated' },
					{ id: '1902', label: 'Extension', unique_name: 'extension' },
				],
			});

			const result = await listSearch.searchUserFields.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/userfields');
			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toEqual({
				name: 'Vaccinated',
				value: '1901',
			});
		});

		it('should filter user fields by name, id, or unique_name', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				list: [
					{ id: '1901', name: 'Vaccinated', unique_name: 'vaccinated' },
					{ id: '1902', name: 'Date of Joining', unique_name: 'dateofjoining' },
				],
			});

			const result = await listSearch.searchUserFields.call(mockLoadOptionsFunctions, 'date');
			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('1902');
		});

		it('should return list of user fields from response.data array', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [
					{ id: '3001', name: 'Employee ID' },
					{ id: '3002', unique_name: 'office_location' },
				],
			});

			const result = await listSearch.searchUserFields.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toEqual({
				name: 'Employee ID',
				value: '3001',
			});
			expect(result.results[1]).toEqual({
				name: 'office_location',
				value: '3002',
			});
		});

		it('should return list of user fields from response.data.list', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					list: [{ id: '4001', label: 'Desk Number' }],
				},
			});

			const result = await listSearch.searchUserFields.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'Desk Number',
				value: '4001',
			});
		});

		it('should skip entries without an id in searchUserFields', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [{ name: 'Missing ID' }, { id: '5002', name: 'Has ID' }],
			});

			const result = await listSearch.searchUserFields.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('5002');
		});

		it('should handle API errors gracefully', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));

			const result = await listSearch.searchUserFields.call(mockLoadOptionsFunctions);
			expect(result.results).toEqual([]);
		});

		it('should use id as fallback user-field name', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [{ id: '7001' }],
			});

			const fallbackNameResult = await listSearch.searchUserFields.call(mockLoadOptionsFunctions);
			expect(fallbackNameResult.results).toEqual([
				{
					name: '7001',
					value: '7001',
				},
			]);
		});

		it('should return empty for non-list object shape', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: null,
			});

			const invalidShapeResult = await listSearch.searchUserFields.call(mockLoadOptionsFunctions);
			expect(invalidShapeResult.results).toEqual([]);
		});
	});

	describe('searchRoles', () => {
		it('should return list of roles', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [
					{ id: 'R1', name: 'Admin' },
					{ id: 'R2', name: 'Member' },
				],
			});

			const result = await listSearch.searchRoles.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {});
			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toEqual({
				name: 'Admin',
				value: 'R1',
			});
		});

		it('should filter roles by id or name', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [
					{ id: 'R1', name: 'Admin' },
					{ id: 'profile_support', name: 'Support' },
				],
			});

			const result = await listSearch.searchRoles.call(mockLoadOptionsFunctions, 'support');

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('profile_support');
		});

		it('should support profiles response shape and fallback name', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				profiles: [{ profile_id: 'R3', profile_type: 'Cliq Admin' }],
			});

			const result = await listSearch.searchRoles.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'Cliq Admin',
				value: 'R3',
			});
		});

		it('should support nested data.roles response shape', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					roles: [{ id: 'R9', display_name: 'Ops Admin' }],
				},
			});

			const result = await listSearch.searchRoles.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([
				{
					name: 'Ops Admin',
					value: 'R9',
				},
			]);
		});

		it('should support nested data.profiles response shape', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					profiles: [{ profile_id: 'P1', profile_type: 'Profile Name' }],
				},
			});

			const result = await listSearch.searchRoles.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([
				{
					name: 'Profile Name',
					value: 'P1',
				},
			]);
		});

		it('should handle API errors gracefully', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));

			const result = await listSearch.searchRoles.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should skip roles without any supported role id fields', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [{ name: 'No ID Role' }, { profile_id: 'R55', profile_type: 'Support' }],
			});

			const result = await listSearch.searchRoles.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([
				{
					name: 'Support',
					value: 'R55',
				},
			]);
		});

		it('should support top-level array and top-level roles response shapes', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue([
				{ id: 'ARR1', displayName: 'Array Role' },
			]);

			const topLevelArrayResult = await listSearch.searchRoles.call(mockLoadOptionsFunctions);
			expect(topLevelArrayResult.results).toEqual([
				{
					name: 'Array Role',
					value: 'ARR1',
				},
			]);

			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				roles: [{ id: 'ROLE_1', display_name: 'Role One' }],
			});

			const topLevelRolesResult = await listSearch.searchRoles.call(mockLoadOptionsFunctions);
			expect(topLevelRolesResult.results).toEqual([
				{
					name: 'Role One',
					value: 'ROLE_1',
				},
			]);
		});

		it('should use role id as fallback role name', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [{ id: 'RID_ONLY' }],
			});

			const fallbackNameResult = await listSearch.searchRoles.call(mockLoadOptionsFunctions);
			expect(fallbackNameResult.results).toEqual([
				{
					name: 'RID_ONLY',
					value: 'RID_ONLY',
				},
			]);
		});

		it('should return empty for unsupported response shape', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {},
			});

			const unsupportedShapeResult = await listSearch.searchRoles.call(mockLoadOptionsFunctions);
			expect(unsupportedShapeResult.results).toEqual([]);
		});
	});

	describe('searchDesignations', () => {
		it('should return list of designations', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [
					{ id: '1901318000001072003', name: 'Leadership Staff' },
					{ id: '1901318000001072007', name: 'Web Developer' },
				],
			});

			const result = await listSearch.searchDesignations.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/designations',
				{},
				{ limit: 100 },
			);
			expect(result.results).toHaveLength(2);
			expect(result.results[0]).toEqual({
				name: 'Leadership Staff',
				value: '1901318000001072003',
			});
		});

		it('should filter designations by id or name', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [
					{ id: 'D1', name: 'Leadership Staff' },
					{ id: 'D2', name: 'Support Team' },
				],
			});

			const result = await listSearch.searchDesignations.call(mockLoadOptionsFunctions, 'support');

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('D2');
		});

		it('should handle API errors gracefully', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));

			const result = await listSearch.searchDesignations.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should skip designations that do not contain any supported id field', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				designations: [{ name: 'No ID Designation' }, { designation_id: 'DS2', name: 'Support' }],
			});

			const result = await listSearch.searchDesignations.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0].value).toBe('DS2');
		});

		it('should use id as designation name fallback when name is missing', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [{ id: 'DS3' }],
			});

			const result = await listSearch.searchDesignations.call(mockLoadOptionsFunctions);

			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'DS3',
				value: 'DS3',
			});
		});

		it('should return empty results when designation response data is not an array', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: { value: 'not-an-array' },
			});

			const result = await listSearch.searchDesignations.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});
	});

	describe('searchTeams', () => {
		it('should return team list', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				teams: [
					{ team_id: 'T1', name: 'Engineering' },
					{ team_id: 'T2', name: 'Marketing' },
				],
			});

			const result = await listSearch.searchTeams.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams', {});
			expect(result.results).toEqual([
				{
					name: 'Engineering',
					value: 'T1',
				},
				{
					name: 'Marketing',
					value: 'T2',
				},
			]);
		});

		it('should filter teams by name or id', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				teams: [
					{ team_id: 'TEAM-1', name: 'Engineering' },
					{ team_id: 'TEAM-2', name: 'Marketing' },
				],
			});

			const filtered = await listSearch.searchTeams.call(mockLoadOptionsFunctions, 'market');

			expect(filtered.results).toHaveLength(1);
			expect(filtered.results[0].value).toBe('TEAM-2');
		});

		it('should handle team search errors gracefully', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));

			const result = await listSearch.searchTeams.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should normalize teams from top-level data array', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [
					{ team_id: 'T10', name: 'Platform' },
					{ team_id: 'T11', name: 'Support' },
				],
			});

			const result = await listSearch.searchTeams.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([
				{
					name: 'Platform',
					value: 'T10',
				},
				{
					name: 'Support',
					value: 'T11',
				},
			]);
		});

		it('should normalize teams from nested data.teams with filter', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					teams: [
						{ team_id: 'T20', name: 'Engineering' },
						{ team_id: 'T21', name: 'Marketing' },
					],
				},
			});

			const result = await listSearch.searchTeams.call(mockLoadOptionsFunctions, 'market');

			expect(result.results).toEqual([
				{
					name: 'Marketing',
					value: 'T21',
				},
			]);
		});

		it('should return empty list when teams payload is missing', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: { value: 'not-an-array' },
			});

			const result = await listSearch.searchTeams.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should skip teams without any supported team id fields', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				teams: [{ name: 'No ID Team' }, { team_id: 'T99', name: 'Has ID Team' }],
			});

			const result = await listSearch.searchTeams.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([
				{
					name: 'Has ID Team',
					value: 'T99',
				},
			]);
		});

		it('should use display_name as fallback team name', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				teams: [{ id: 'T100', display_name: 'Display Name Team' }],
			});

			const result = await listSearch.searchTeams.call(mockLoadOptionsFunctions);
			expect(result.results).toEqual([
				{
					name: 'Display Name Team',
					value: 'T100',
				},
			]);
		});

		it('should use team id as fallback team name when all name fields are missing', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				teams: [{ id: 'T101' }],
			});

			const result = await listSearch.searchTeams.call(mockLoadOptionsFunctions);
			expect(result.results).toEqual([
				{
					name: 'T101',
					value: 'T101',
				},
			]);
		});
	});

	describe('searchUserStatuses', () => {
		it('should return statuses list with message + id labels', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [
					{ id: 'S1', message: 'In a meeting' },
					{ id: 'S2', message: 'Out for lunch' },
				],
			});

			const result = await listSearch.searchUserStatuses.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/statuses');
			expect(result.results).toEqual([
				{
					name: 'In a meeting (S1)',
					value: 'S1',
				},
				{
					name: 'Out for lunch (S2)',
					value: 'S2',
				},
			]);
		});

		it('should support response.statuses shape and filtering', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				statuses: [
					{ id: 'S1', message: 'In a meeting' },
					{ id: 'AB_2', message: 'Available' },
				],
			});

			const result = await listSearch.searchUserStatuses.call(mockLoadOptionsFunctions, 'ab_2');

			expect(result.results).toEqual([
				{
					name: 'Available (AB_2)',
					value: 'AB_2',
				},
			]);
		});

		it('should handle API errors gracefully', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));

			const result = await listSearch.searchUserStatuses.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should skip statuses without ids', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [{ message: 'No id' }, { id: 'S3', message: 'Active' }],
			});

			const result = await listSearch.searchUserStatuses.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([
				{
					name: 'Active (S3)',
					value: 'S3',
				},
			]);
		});

		it('should fall back to status id label when message is empty', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				statuses: [{ id: 'S4' }],
			});

			const statusIdLabelResult =
				await listSearch.searchUserStatuses.call(mockLoadOptionsFunctions);
			expect(statusIdLabelResult.results).toEqual([
				{
					name: 'S4',
					value: 'S4',
				},
			]);
		});

		it('should return empty for invalid status response shape', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				statuses: 'not-an-array',
			});

			const invalidShapeResult = await listSearch.searchUserStatuses.call(mockLoadOptionsFunctions);
			expect(invalidShapeResult.results).toEqual([]);
		});
	});

	describe('searchReminders', () => {
		it('should return reminders list', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				list: [
					{ id: 'R1', content: 'Submit invoice' },
					{ id: 'R2', content: 'Follow up with client' },
				],
			});

			const result = await listSearch.searchReminders.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/reminders',
				{},
				{ category: 'mine', limit: 100 },
			);
			expect(result.results).toEqual([
				{
					name: 'Submit invoice',
					value: 'R1',
				},
				{
					name: 'Follow up with client',
					value: 'R2',
				},
			]);
		});

		it('should filter by content or id', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				list: [
					{ id: 'R1', content: 'Submit invoice' },
					{ id: 'R2', content: 'Follow up with client' },
				],
			});

			const filtered = await listSearch.searchReminders.call(mockLoadOptionsFunctions, 'R2');

			expect(filtered.results).toHaveLength(1);
			expect(filtered.results[0].value).toBe('R2');
		});

		it('should handle reminder search errors gracefully', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));

			const result = await listSearch.searchReminders.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([]);
		});

		it('should use fallback name when reminder content is missing', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				list: [{ id: 'R3' }],
			});

			const result = await listSearch.searchReminders.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/reminders',
				{},
				{ category: 'mine', limit: 100 },
			);
			expect(result.results).toEqual([
				{
					name: 'Reminder R3',
					value: 'R3',
				},
			]);
		});

		it('should skip reminders that do not have an id', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				list: [{ content: 'No id reminder' }, { id: 'R4', content: 'Valid reminder' }],
			});

			const result = await listSearch.searchReminders.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/reminders',
				{},
				{ category: 'mine', limit: 100 },
			);
			expect(result.results).toHaveLength(1);
			expect(result.results[0]).toEqual({
				name: 'Valid reminder',
				value: 'R4',
			});
		});

		it('should return empty reminder results when list is not an array', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				list: null,
			});

			const result = await listSearch.searchReminders.call(mockLoadOptionsFunctions);
			expect(result.results).toEqual([]);
		});
	});

	describe('searchUsers', () => {
		it('should return users from nested data.users', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					users: [
						{
							user_id: 'U 1/2',
							display_name: 'Ada Lovelace',
							email_id: 'ada@example.com',
						},
						{
							id: 'U2',
							first_name: 'Grace',
							email: 'grace@example.com',
						},
					],
				},
			});

			const result = await listSearch.searchUsers.call(mockLoadOptionsFunctions);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/users',
				{},
				{ limit: 100, fields: 'display_name' },
			);
			expect(result.results).toEqual([
				{
					name: 'Ada Lovelace (ada@example.com)',
					value: 'U 1/2',
				},
				{
					name: 'Grace (grace@example.com)',
					value: 'U2',
				},
			]);
		});

		it('should support top-level users shape and filter by email and id', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				users: [
					{ zuid: 1001, name: 'Jordan', email: 'jordan@example.com' },
					{ email_id: 'sam@example.com', display_name: 'Sam' },
				],
			});

			const byEmail = await listSearch.searchUsers.call(mockLoadOptionsFunctions, 'sam@example');
			expect(byEmail.results).toEqual([
				{
					name: 'Sam (sam@example.com)',
					value: 'sam@example.com',
				},
			]);

			const byId = await listSearch.searchUsers.call(mockLoadOptionsFunctions, '1001');
			expect(byId.results).toEqual([
				{
					name: 'Jordan (jordan@example.com)',
					value: '1001',
				},
			]);
		});

		it('should skip users with no supported identifier fields', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: [{ display_name: 'Missing ID' }, { user_id: 'U9', display_name: 'Has ID' }],
			});

			const result = await listSearch.searchUsers.call(mockLoadOptionsFunctions);

			expect(result.results).toEqual([
				{
					name: 'Has ID',
					value: 'U9',
				},
			]);
		});

		it('should fall back to user id for label', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				users: [{ id: 'U10' }],
			});

			const result = await listSearch.searchUsers.call(mockLoadOptionsFunctions);
			expect(result.results).toEqual([
				{
					name: 'U10',
					value: 'U10',
				},
			]);
		});

		it('should return empty results on API errors', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('API error'));
			const errorResult = await listSearch.searchUsers.call(mockLoadOptionsFunctions);
			expect(errorResult.results).toEqual([]);
		});

		it('should return empty when users response shape is invalid', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: { users: 'not-an-array' },
			});

			const result = await listSearch.searchUsers.call(mockLoadOptionsFunctions);
			expect(result.results).toEqual([]);
		});
	});
});
