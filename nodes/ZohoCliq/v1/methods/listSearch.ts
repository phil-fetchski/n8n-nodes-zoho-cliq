/**
 * Resource loaders for searchable dropdowns
 */

import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
} from 'n8n-workflow';

import { zohoCliqApiRequest } from '../transport';
import { isZohoCliqChannelListResponse } from '../helpers/interfaces';

function toNonEmptyString(value: unknown): string {
	if (typeof value === 'string' && value.trim()) {
		return value.trim();
	}

	if (typeof value === 'number' || typeof value === 'bigint') {
		return String(value);
	}

	return '';
}

export const listSearch = {
	// Resource loader for channel selection
	async searchChannels(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			// Build query parameters for channel search
			const qs: Record<string, string | number | boolean> = {
				limit: 100,
			};

			// Make API request to list channels
			const response = await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/channels',
				{},
				qs,
			);

			if (isZohoCliqChannelListResponse(response) && response.channels) {
				for (const channel of response.channels) {
					const channelName =
						(channel.name as string) ||
						(channel.unique_name as string) ||
						(channel.channel_id as string);
					const channelId = channel.channel_id as string;

					// Filter results if search term provided
					if (filter) {
						const searchLower = filter.toLowerCase();
						const nameMatch = channelName.toLowerCase().includes(searchLower);
						const uniqueNameMatch =
							(channel.unique_name as string | undefined)?.toLowerCase().includes(searchLower) ||
							false;

						if (!nameMatch && !uniqueNameMatch) {
							continue;
						}
					}

					returnData.results.push({
						name: channelName,
						value: channelId,
					});
				}
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
			// User will see "No items found" in dropdown
		}

		return returnData;
	},

	async searchDepartments(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			const response = (await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/departments',
				{},
				{ limit: 100 },
			)) as IDataObject;

			const maybeData = response.data;
			const departments = Array.isArray(response.departments)
				? (response.departments as IDataObject[])
				: Array.isArray(response.data)
					? (response.data as IDataObject[])
					: maybeData &&
						  typeof maybeData === 'object' &&
						  !Array.isArray(maybeData) &&
						  Array.isArray((maybeData as IDataObject).departments)
						? ((maybeData as IDataObject).departments as IDataObject[])
						: [];

			for (const department of departments) {
				const departmentId =
					toNonEmptyString(department.department_id) ||
					toNonEmptyString(department.id) ||
					toNonEmptyString(department.departmentId) ||
					toNonEmptyString(department.zuid);

				if (!departmentId) {
					continue;
				}

				const departmentName =
					toNonEmptyString(department.name) ||
					toNonEmptyString(department.display_name) ||
					toNonEmptyString(department.displayName) ||
					departmentId;

				if (filter) {
					const searchLower = filter.toLowerCase();
					const nameMatch = departmentName.toLowerCase().includes(searchLower);
					const idMatch = departmentId.toLowerCase().includes(searchLower);

					if (!nameMatch && !idMatch) {
						continue;
					}
				}

				returnData.results.push({
					name: departmentName,
					value: departmentId,
				});
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
		}

		return returnData;
	},

	async searchUserStatuses(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			const response = (await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/statuses',
			)) as IDataObject;

			const statuses = Array.isArray(response.data)
				? (response.data as IDataObject[])
				: Array.isArray(response.statuses)
					? (response.statuses as IDataObject[])
					: [];

			for (const status of statuses) {
				const statusId = toNonEmptyString(status.id);
				if (!statusId) {
					continue;
				}

				const message = toNonEmptyString(status.message);
				const label = message ? `${message} (${statusId})` : statusId;

				if (filter) {
					const searchLower = filter.toLowerCase();
					const messageMatch = message.toLowerCase().includes(searchLower);
					const idMatch = statusId.toLowerCase().includes(searchLower);

					if (!messageMatch && !idMatch) {
						continue;
					}
				}

				returnData.results.push({
					name: label,
					value: statusId,
				});
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
		}

		return returnData;
	},

	async searchUserFields(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			const response = (await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/userfields',
			)) as IDataObject;

			const userFields = Array.isArray(response.list)
				? (response.list as IDataObject[])
				: Array.isArray(response.data)
					? (response.data as IDataObject[])
					: response.data &&
						  typeof response.data === 'object' &&
						  !Array.isArray(response.data) &&
						  Array.isArray((response.data as IDataObject).list)
						? ((response.data as IDataObject).list as IDataObject[])
						: [];

			for (const userField of userFields) {
				const fieldId = toNonEmptyString(userField.id);
				if (!fieldId) {
					continue;
				}

				const fieldName =
					toNonEmptyString(userField.name) ||
					toNonEmptyString(userField.label) ||
					toNonEmptyString(userField.unique_name) ||
					fieldId;

				if (filter) {
					const searchLower = filter.toLowerCase();
					const nameMatch = fieldName.toLowerCase().includes(searchLower);
					const idMatch = fieldId.toLowerCase().includes(searchLower);
					const uniqueNameMatch = toNonEmptyString(userField.unique_name)
						.toLowerCase()
						.includes(searchLower);

					if (!nameMatch && !idMatch && !uniqueNameMatch) {
						continue;
					}
				}

				returnData.results.push({
					name: fieldName,
					value: fieldId,
				});
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
		}

		return returnData;
	},

	async searchTeams(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			const response = (await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/teams',
				{},
			)) as IDataObject;

			const maybeData = response.data;
			const teams = Array.isArray(response.teams)
				? (response.teams as IDataObject[])
				: Array.isArray(response.data)
					? (response.data as IDataObject[])
					: maybeData &&
						  typeof maybeData === 'object' &&
						  !Array.isArray(maybeData) &&
						  Array.isArray((maybeData as IDataObject).teams)
						? ((maybeData as IDataObject).teams as IDataObject[])
						: [];

			for (const team of teams) {
				const teamId =
					toNonEmptyString(team.team_id) ||
					toNonEmptyString(team.id) ||
					toNonEmptyString(team.teamId);

				if (!teamId) {
					continue;
				}

				const teamName =
					toNonEmptyString(team.name) ||
					toNonEmptyString(team.display_name) ||
					toNonEmptyString(team.displayName) ||
					teamId;

				if (filter) {
					const searchLower = filter.toLowerCase();
					const nameMatch = teamName.toLowerCase().includes(searchLower);
					const idMatch = teamId.toLowerCase().includes(searchLower);

					if (!nameMatch && !idMatch) {
						continue;
					}
				}

				returnData.results.push({
					name: teamName,
					value: teamId,
				});
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
		}

		return returnData;
	},

	async searchRoles(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			const response = (await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/profiles',
				{},
			)) as IDataObject;

			const roles = Array.isArray(response)
				? (response as IDataObject[])
				: Array.isArray(response.data)
					? (response.data as IDataObject[])
					: response.data &&
						  typeof response.data === 'object' &&
						  !Array.isArray(response.data) &&
						  Array.isArray((response.data as IDataObject).profiles)
						? ((response.data as IDataObject).profiles as IDataObject[])
						: response.data &&
							  typeof response.data === 'object' &&
							  !Array.isArray(response.data) &&
							  Array.isArray((response.data as IDataObject).roles)
							? ((response.data as IDataObject).roles as IDataObject[])
							: Array.isArray(response.profiles)
								? (response.profiles as IDataObject[])
								: Array.isArray(response.roles)
									? (response.roles as IDataObject[])
									: [];

			for (const role of roles) {
				const roleId =
					toNonEmptyString(role.id) ||
					toNonEmptyString(role.profile_id) ||
					toNonEmptyString(role.profileId);

				if (!roleId) {
					continue;
				}

				const roleName =
					toNonEmptyString(role.name) ||
					toNonEmptyString(role.profile_type) ||
					toNonEmptyString(role.display_name) ||
					toNonEmptyString(role.displayName) ||
					roleId;

				if (filter) {
					const searchLower = filter.toLowerCase();
					const nameMatch = roleName.toLowerCase().includes(searchLower);
					const idMatch = roleId.toLowerCase().includes(searchLower);

					if (!nameMatch && !idMatch) {
						continue;
					}
				}

				returnData.results.push({
					name: roleName,
					value: roleId,
				});
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
		}

		return returnData;
	},

	async searchDesignations(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			const response = (await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/designations',
				{},
				{ limit: 100 },
			)) as IDataObject;

			const designations = Array.isArray(response.designations)
				? (response.designations as IDataObject[])
				: Array.isArray(response.data)
					? (response.data as IDataObject[])
					: [];

			for (const designation of designations) {
				const designationId =
					toNonEmptyString(designation.id) || toNonEmptyString(designation.designation_id);

				if (!designationId) {
					continue;
				}

				const designationName = toNonEmptyString(designation.name) || designationId;

				if (filter) {
					const searchLower = filter.toLowerCase();
					const nameMatch = designationName.toLowerCase().includes(searchLower);
					const idMatch = designationId.toLowerCase().includes(searchLower);

					if (!nameMatch && !idMatch) {
						continue;
					}
				}

				returnData.results.push({
					name: designationName,
					value: designationId,
				});
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
		}

		return returnData;
	},

	async searchReminders(
		this: ILoadOptionsFunctions,
		filter?: string,
	): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			const response = (await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/reminders',
				{},
				{ category: 'mine', limit: 100 },
			)) as IDataObject;

			const reminders = Array.isArray(response.list) ? (response.list as IDataObject[]) : [];

			for (const reminder of reminders) {
				const reminderId = toNonEmptyString(reminder.id);
				if (!reminderId) {
					continue;
				}

				const content = toNonEmptyString(reminder.content);
				const reminderName = content ? content : `Reminder ${reminderId}`;

				if (filter) {
					const searchLower = filter.toLowerCase();
					const contentMatch = reminderName.toLowerCase().includes(searchLower);
					const idMatch = reminderId.toLowerCase().includes(searchLower);

					if (!contentMatch && !idMatch) {
						continue;
					}
				}

				returnData.results.push({
					name: reminderName,
					value: reminderId,
				});
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
		}

		return returnData;
	},

	async searchUsers(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
		const returnData: INodeListSearchResult = { results: [] };

		try {
			const response = (await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				'/api/v2/users',
				{},
				{ limit: 100, fields: 'display_name' },
			)) as IDataObject;

			const maybeData = response.data;
			const users = Array.isArray(response.users)
				? (response.users as IDataObject[])
				: Array.isArray(response.data)
					? (response.data as IDataObject[])
					: maybeData &&
						  typeof maybeData === 'object' &&
						  !Array.isArray(maybeData) &&
						  Array.isArray((maybeData as IDataObject).users)
						? ((maybeData as IDataObject).users as IDataObject[])
						: [];

			for (const user of users) {
				const userId =
					toNonEmptyString(user.user_id) ||
					toNonEmptyString(user.id) ||
					toNonEmptyString(user.zuid) ||
					toNonEmptyString(user.email_id) ||
					toNonEmptyString(user.email);

				if (!userId) {
					continue;
				}

				const displayName =
					toNonEmptyString(user.display_name) ||
					toNonEmptyString(user.first_name) ||
					toNonEmptyString(user.name) ||
					userId;
				const email = toNonEmptyString(user.email_id) || toNonEmptyString(user.email);
				const label = email ? `${displayName} (${email})` : displayName;

				if (filter) {
					const searchLower = filter.toLowerCase();
					const labelMatch = label.toLowerCase().includes(searchLower);
					const idMatch = userId.toLowerCase().includes(searchLower);
					const emailMatch = email.toLowerCase().includes(searchLower);

					if (!labelMatch && !idMatch && !emailMatch) {
						continue;
					}
				}

				returnData.results.push({
					name: label,
					value: userId,
				});
			}
		} catch {
			// Return empty results on error (N8N pattern for resource loaders)
		}

		return returnData;
	},
};
