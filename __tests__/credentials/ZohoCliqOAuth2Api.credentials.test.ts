import {
	ALL_SCOPES_CSV,
	DEFAULT_CLIQ_SCOPES,
	DEFAULT_CLIQ_SCOPES_CSV,
	DEFAULT_SCOPE_PACK_SELECTION,
	SCOPE_PACKS,
	ZOHO_PEOPLE_REMOTE_WORK_SCOPES,
	ZohoCliqOAuth2Api,
	buildScopeCsvFromMode,
	getScopesForPackSelection,
	validateZohoCliqScopes,
	hasRequiredScope,
} from '../../credentials/ZohoCliqOAuth2Api.credentials';
import { CREDENTIALS_SETUP_GUIDE_LINK } from '../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliqOAuth2Api', () => {
	describe('Credential Class', () => {
		let credentialClass: ZohoCliqOAuth2Api;

		beforeEach(() => {
			credentialClass = new ZohoCliqOAuth2Api();
		});

		it('should have correct name', () => {
			expect(credentialClass.name).toBe('zohoCliqOAuth2Api');
		});

		it('should have correct display name', () => {
			expect(credentialClass.displayName).toBe('Zoho Cliq OAuth2 API');
		});

		it('should extend oAuth2Api', () => {
			expect(credentialClass.extends).toContain('oAuth2Api');
		});

		it('should have correct documentation URL', () => {
			expect(credentialClass.documentationUrl).toBe(CREDENTIALS_SETUP_GUIDE_LINK);
		});

		it('should have all required properties', () => {
			expect(credentialClass.properties).toBeDefined();
			expect(Array.isArray(credentialClass.properties)).toBe(true);
			expect(credentialClass.properties.length).toBeGreaterThan(0);
		});

		it('should have data center property with all valid options', () => {
			const dcProperty = credentialClass.properties.find((p) => p.name === 'dc');
			expect(dcProperty).toBeDefined();
			expect(dcProperty?.type).toBe('options');
			expect(dcProperty?.default).toBe('us');
			expect(dcProperty?.required).toBe(true);

			const options = dcProperty?.options as Array<{ value: string }>;
			const validDataCenters = ['us', 'eu', 'in', 'au', 'jp', 'cn', 'sa', 'uk', 'ca'];
			const optionValues = options.map((o) => o.value);

			validDataCenters.forEach((dc) => {
				expect(optionValues).toContain(dc);
			});
		});

		it('should have a documentationUrl pointing to the credentials setup guide', () => {
			expect(credentialClass.documentationUrl).toBeDefined();
			expect(credentialClass.documentationUrl).toContain('CREDENTIALS.md');
		});

		it('should have scope property with correct defaults', () => {
			const scopeProperty = credentialClass.properties.find((p) => p.name === 'scope');
			expect(scopeProperty).toBeDefined();
			expect(scopeProperty?.type).toBe('hidden');
			expect(scopeProperty?.required).toBe(true);
			expect(typeof scopeProperty?.default).toBe('string');
			const defaultScopeExpression = String(scopeProperty?.default);
			expect(defaultScopeExpression).toContain('scopeMode');
			expect(defaultScopeExpression).toContain('rawScopeCsv');
			expect(defaultScopeExpression).toContain('selectedScopePacks');
			expect(defaultScopeExpression).toContain('allScopesValue');
		});

		it('should expose three scope selection modes', () => {
			const scopeMode = credentialClass.properties.find((p) => p.name === 'scopeMode');
			expect(scopeMode).toBeDefined();
			expect(scopeMode?.type).toBe('options');
			expect(scopeMode?.default).toBe('scopePacks');

			const modeOptions = (scopeMode?.options as Array<{ value: string }>).map((opt) => opt.value);
			expect(modeOptions).toEqual(['allScopes', 'scopePacks', 'rawCsv']);

			const rawScopeCsv = credentialClass.properties.find((p) => p.name === 'rawScopeCsv');
			expect(rawScopeCsv).toBeDefined();
			expect(rawScopeCsv?.type).toBe('string');
			expect(rawScopeCsv?.default).toBe('');
			expect(rawScopeCsv?.placeholder).toBe(`e.g. ${ALL_SCOPES_CSV}`);

			const selectedScopePacks = credentialClass.properties.find(
				(p) => p.name === 'selectedScopePacks',
			);
			expect(selectedScopePacks).toBeDefined();
			expect(selectedScopePacks?.type).toBe('multiOptions');
			expect(selectedScopePacks?.default).toEqual(['coreMessaging', 'botAndWebhooks']);
			expect((selectedScopePacks?.default as string[]).length).toBeGreaterThan(0);

			const selectedPackOptions = selectedScopePacks?.options as Array<{
				name: string;
				value: string;
			}>;
			expect(selectedPackOptions.map((opt) => opt.name)).toContain('Remote Work + Zoho People');
			expect(selectedPackOptions.map((opt) => opt.value)).toContain(
				SCOPE_PACKS.remoteWorkZohoPeople.scopes.join(','),
			);
			expect(selectedPackOptions.map((opt) => opt.value)).toContain(
				SCOPE_PACKS.coreMessaging.scopes.join(','),
			);

			const legacyToggle = credentialClass.properties.find((p) => p.name === 'allScopesValue');
			expect(legacyToggle).toBeDefined();
			expect(legacyToggle?.type).toBe('hidden');
			expect(legacyToggle?.default).toBe(ALL_SCOPES_CSV);
		});

		it('should have authentication configuration', () => {
			expect(credentialClass.authenticate).toBeDefined();
			expect(credentialClass.authenticate.type).toBe('generic');
			expect(credentialClass.authenticate.properties).toBeDefined();
		});

		it('should request offline access and consent for refresh token issuance', () => {
			const authQueryParameters = credentialClass.properties.find(
				(p) => p.name === 'authQueryParameters',
			);
			expect(authQueryParameters).toBeDefined();
			expect(authQueryParameters?.type).toBe('hidden');
			expect(authQueryParameters?.default).toBe('access_type=offline&prompt=consent');
		});

		it('should have test endpoint configuration', () => {
			expect(credentialClass.test).toBeDefined();
			expect(credentialClass.test.request).toBeDefined();
			expect(credentialClass.test.request.url).toBe('/api/v2/statuses/current');
			expect(credentialClass.test.request.timeout).toBe(10000);

			const baseUrlExpression = String(credentialClass.test.request.baseURL);
			expect(baseUrlExpression).toContain('$credentials?.dc');
			expect(baseUrlExpression).toContain('https://cliq.zoho.com');
			expect(baseUrlExpression).toContain('https://cliq.zoho.com.au');
			expect(baseUrlExpression).toContain('https://cliq.zoho.com.cn');
			expect(baseUrlExpression).toContain('https://cliq.zohocloud.ca');
		});
	});

	describe('scope pack composition', () => {
		it('should preserve exact canonical base scope strings and order', () => {
			expect(DEFAULT_CLIQ_SCOPES).toEqual([
				'ZohoCliq.Bots.READ',
				'ZohoCliq.Channels.ALL',
				'ZohoCliq.Chats.ALL',
				'ZohoCliq.Messages.READ',
				'ZohoCliq.Messages.UPDATE',
				'ZohoCliq.Messages.DELETE',
				'ZohoCliq.messages.CREATE',
				'ZohoCliq.Profile.READ',
				'ZohoCliq.Reminders.ALL',
				'ZohoCliq.StorageData.ALL',
				'ZohoCliq.Teams.ALL',
				'ZohoCliq.Webhooks.CREATE',
				'ZohoCliq.Profile.CREATE',
				'ZohoCliq.Profile.DELETE',
				'ZohoCliq.Users.CREATE',
				'ZohoCliq.Users.READ',
				'ZohoCliq.Users.UPDATE',
				'Profile.orguserphoto.UPDATE',
				'ZohoCliq.UserFields.CREATE',
				'ZohoCliq.UserFields.UPDATE',
				'ZohoCliq.UserFields.DELETE',
				'ZohoCliq.Profile.UPDATE',
				'ZohoCliq.Attachments.READ',
				'ZohoCliq.Departments.ALL',
				'ZohoCliq.Organisation.READ',
				'ZohoCliq.Organisation.CREATE',
				'ZohoCliq.Organisation.UPDATE',
				'ZohoCliq.Organisation.DELETE',
				'ZohoCliq.OrganizationChannels.READ',
				'ZohoCliq.OrganizationChats.READ',
				'ZohoCliq.OrganizationMessages.READ',
				'ZohoCliq.Applications.update',
				'ZohoCliq.CalendarEvents.ALL',
				'ZohoCalendar.calendar.ALL',
				'ZohoCalendar.event.ALL',
				'ZohoCalendar.search.READ',
				'ZohoCliq.Designations.ALL',
				'ZohoCliq.MediaSession.READ',
				'ZohoCliq.messageactions.READ',
				'ZohoCliq.messageactions.CREATE',
				'ZohoCliq.messageactions.DELETE',
			]);
		});

		it('should include all currently configured base scopes in default pack selection', () => {
			const scopes = getScopesForPackSelection(DEFAULT_SCOPE_PACK_SELECTION);
			expect(scopes).toEqual(DEFAULT_CLIQ_SCOPES);
		});

		it('should keep all-scopes mode equal to canonical all scope csv', () => {
			expect(buildScopeCsvFromMode({ scopeMode: 'allScopes' })).toBe(ALL_SCOPES_CSV);
		});

		it('should default to scopePacks mode when scopeMode is omitted', () => {
			expect(buildScopeCsvFromMode({})).toBe(DEFAULT_CLIQ_SCOPES_CSV);
		});

		it('should dedupe raw CSV mode while preserving exact casing and spelling', () => {
			const scopeCsv = buildScopeCsvFromMode({
				scopeMode: 'rawCsv',
				rawScopeCsv: 'ZohoCliq.Messages.CREATE, ZohoCliq.Messages.CREATE, ZohoCliq.messages.CREATE',
			});
			expect(scopeCsv).toBe('ZohoCliq.Messages.CREATE,ZohoCliq.messages.CREATE');
		});

		it('should return empty string for raw CSV mode when raw input is omitted', () => {
			expect(buildScopeCsvFromMode({ scopeMode: 'rawCsv' })).toBe('');
		});

		it('should include Zoho People scopes when legacy toggle is enabled in scope packs mode', () => {
			const scopeCsv = buildScopeCsvFromMode({
				scopeMode: 'scopePacks',
				selectedScopePacks: DEFAULT_SCOPE_PACK_SELECTION,
				includeZohoPeopleScopePack: true,
			});
			expect(scopeCsv).toContain('ZohoPeople.forms.READ');
			expect(scopeCsv).toContain('ZohoPeople.employee.READ');
			expect(scopeCsv).toContain('ZohoPeople.attendance.READ');
			expect(scopeCsv).toContain('ZohoPeople.attendance.UPDATE');
		});

		it('should resolve UI CSV option values to pack names in scope packs mode', () => {
			const credentialClass = new ZohoCliqOAuth2Api();
			const selectedPackOptions = (credentialClass.properties.find(
				(p: { name?: string }) => p.name === 'selectedScopePacks',
			)?.options ?? []) as Array<{ name: string; value: string }>;
			const scopeCsv = buildScopeCsvFromMode({
				scopeMode: 'scopePacks',
				selectedScopePacks: selectedPackOptions.map((opt) => opt.value),
			});

			expect(scopeCsv).toBe(
				DEFAULT_CLIQ_SCOPES_CSV + ',' + ZOHO_PEOPLE_REMOTE_WORK_SCOPES.join(','),
			);
		});

		it('should ignore unknown and duplicate scope pack selections', () => {
			const scopes = getScopesForPackSelection([
				'coreMessaging',
				'coreMessaging',
				'unknownPack',
				SCOPE_PACKS.coreMessaging.scopes.join(','),
			]);

			expect(scopes).toEqual(SCOPE_PACKS.coreMessaging.scopes);
		});

		it('should keep unknown custom scopes after canonical scopes when sorting', () => {
			const coreMessagingScopes = (SCOPE_PACKS.coreMessaging.scopes as unknown as string[]).slice();
			try {
				(SCOPE_PACKS.coreMessaging.scopes as unknown as string[]).push(
					'ZohoCliq.CustomScope.UNLISTED_A',
					'ZohoCliq.CustomScope.UNLISTED_B',
				);

				const scopes = getScopesForPackSelection(['coreMessaging']);
				const lastTwo = scopes.slice(-2);

				expect(lastTwo).toContain('ZohoCliq.CustomScope.UNLISTED_A');
				expect(lastTwo).toContain('ZohoCliq.CustomScope.UNLISTED_B');
			} finally {
				(SCOPE_PACKS.coreMessaging.scopes as unknown as string[]).splice(
					0,
					(SCOPE_PACKS.coreMessaging.scopes as unknown as string[]).length,
					...coreMessagingScopes,
				);
			}
		});

		it('should expose all plan packs in catalog', () => {
			expect(Object.keys(SCOPE_PACKS)).toEqual([
				'coreMessaging',
				'corePeopleProfile',
				'coreTeamsOrgStructure',
				'eventsCalendar',
				'remindersTasks',
				'filesStorage',
				'orgAdmin',
				'remoteWorkZohoPeople',
				'botAndWebhooks',
			]);
		});
	});

	describe('validateZohoCliqScopes', () => {
		describe('when valid scopes provided', () => {
			it('should return empty array for single valid scope', () => {
				const errors = validateZohoCliqScopes('ZohoCliq.Channels.CREATE');
				expect(errors).toEqual([]);
			});

			it('should return empty array for multiple valid scopes', () => {
				const errors = validateZohoCliqScopes(
					'ZohoCliq.Channels.CREATE,ZohoCliq.Bots.CREATE,ZohoCliq.Chats.CREATE',
				);
				expect(errors).toEqual([]);
			});

			it('should handle scopes with whitespace', () => {
				const errors = validateZohoCliqScopes('ZohoCliq.Channels.CREATE, ZohoCliq.Bots.CREATE');
				expect(errors).toEqual([]);
			});

			it('should accept all valid resources', () => {
				const validResources = [
					'Applications',
					'Attachments',
					'Bots',
					'CalendarEvents',
					'Channels',
					'Chats',
					'Departments',
					'Designations',
					'MediaSession',
					'Messages',
					'Organisation',
					'Organization',
					'OrganizationChannels',
					'OrganizationChats',
					'OrganizationMessages',
					'Profile',
					'Reminders',
					'StorageData',
					'Statuses',
					'Teams',
					'UserFields',
					'Users',
					'Webhooks',
					'messageactions',
					'messages',
					'calendar',
					'event',
					'search',
				];
				validResources.forEach((resource) => {
					const errors = validateZohoCliqScopes(`ZohoCliq.${resource}.CREATE`);
					expect(errors).toEqual([]);
				});
			});

			it('should accept all valid operations', () => {
				const validOperations = [
					'CREATE',
					'READ',
					'UPDATE',
					'DELETE',
					'ALL',
					'create',
					'read',
					'update',
					'delete',
				];
				validOperations.forEach((operation) => {
					const errors = validateZohoCliqScopes(`ZohoCliq.Channels.${operation}`);
					expect(errors).toEqual([]);
				});
			});

			it('should accept ZohoCalendar prefix scopes', () => {
				const calendarScopes = [
					'ZohoCalendar.calendar.ALL',
					'ZohoCalendar.event.ALL',
					'ZohoCalendar.search.READ',
				];
				calendarScopes.forEach((scope) => {
					const errors = validateZohoCliqScopes(scope);
					expect(errors).toEqual([]);
				});
			});

			it('should accept ZohoPeople prefix scopes', () => {
				const peopleScopes = [
					'ZohoPeople.forms.READ',
					'ZohoPeople.employee.READ',
					'ZohoPeople.attendance.READ',
					'ZohoPeople.attendance.UPDATE',
				];
				peopleScopes.forEach((scope) => {
					const errors = validateZohoCliqScopes(scope);
					expect(errors).toEqual([]);
				});
			});

			it('should accept Profile prefix scopes', () => {
				const errors = validateZohoCliqScopes('Profile.orguserphoto.UPDATE');
				expect(errors).toEqual([]);
			});

			it('should accept mixed-case operations', () => {
				const mixedCaseScopes = [
					'ZohoCliq.Applications.update',
					'ZohoCliq.messages.CREATE',
					'ZohoCliq.messageactions.READ',
					'ZohoCalendar.calendar.create',
				];
				mixedCaseScopes.forEach((scope) => {
					const errors = validateZohoCliqScopes(scope);
					expect(errors).toEqual([]);
				});
			});
		});

		describe('when invalid scopes provided', () => {
			it('should return error for empty scope', () => {
				const errors = validateZohoCliqScopes('');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain('OAuth scope is required');
			});

			it('should return error for whitespace-only scope', () => {
				const errors = validateZohoCliqScopes('   ');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain('OAuth scope is required');
			});

			it('should return error for scope without prefix', () => {
				const errors = validateZohoCliqScopes('Channels.CREATE');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain(
					'Must start with one of: ZohoCliq., ZohoCalendar., ZohoPeople., Profile.',
				);
			});

			it('should return error for scope with wrong prefix', () => {
				const errors = validateZohoCliqScopes('Zoho.Channels.CREATE');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain(
					'Must start with one of: ZohoCliq., ZohoCalendar., ZohoPeople., Profile.',
				);
			});

			it('should return error for scope with invalid format', () => {
				const errors = validateZohoCliqScopes('ZohoCliq.Channels');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain('Expected format');
			});

			it('should return error for scope with too many parts', () => {
				const errors = validateZohoCliqScopes('ZohoCliq.Channels.CREATE.EXTRA');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain('Expected format');
			});

			it('should return error for invalid resource', () => {
				const errors = validateZohoCliqScopes('ZohoCliq.InvalidResource.CREATE');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain('Invalid resource');
			});

			it('should return error for invalid operation', () => {
				const errors = validateZohoCliqScopes('ZohoCliq.Channels.INVALID');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain('Invalid operation');
			});

			it('should return multiple errors for multiple invalid scopes', () => {
				const errors = validateZohoCliqScopes(
					'InvalidScope,ZohoCliq.Invalid.CREATE,ZohoCliq.Channels.INVALID',
				);
				expect(errors.length).toBeGreaterThan(1);
			});
		});

		describe('edge cases', () => {
			it('should handle comma-only input', () => {
				const errors = validateZohoCliqScopes(',,,');
				expect(errors).toHaveLength(1);
				expect(errors[0]).toContain('At least one OAuth scope must be specified');
			});

			it('should filter out empty scopes between commas', () => {
				const errors = validateZohoCliqScopes('ZohoCliq.Channels.CREATE,,ZohoCliq.Bots.CREATE');
				expect(errors).toEqual([]);
			});

			it('should handle leading/trailing commas', () => {
				const errors = validateZohoCliqScopes(',ZohoCliq.Channels.CREATE,');
				expect(errors).toEqual([]);
			});
		});
	});

	describe('hasRequiredScope', () => {
		describe('when exact scope match', () => {
			it('should return true for exact match', () => {
				const result = hasRequiredScope('ZohoCliq.Channels.CREATE', 'ZohoCliq.Channels.CREATE');
				expect(result).toBe(true);
			});

			it('should return true when scope is in list', () => {
				const result = hasRequiredScope(
					'ZohoCliq.Channels.CREATE,ZohoCliq.Bots.CREATE',
					'ZohoCliq.Bots.CREATE',
				);
				expect(result).toBe(true);
			});

			it('should handle whitespace in granted scopes', () => {
				const result = hasRequiredScope(
					'ZohoCliq.Channels.CREATE, ZohoCliq.Bots.CREATE',
					'ZohoCliq.Bots.CREATE',
				);
				expect(result).toBe(true);
			});
		});

		describe('when wildcard scope match', () => {
			it('should return true for wildcard ALL permission', () => {
				const result = hasRequiredScope('ZohoCliq.Channels.ALL', 'ZohoCliq.Channels.CREATE');
				expect(result).toBe(true);
			});

			it('should return true when wildcard is in list', () => {
				const result = hasRequiredScope(
					'ZohoCliq.Channels.ALL,ZohoCliq.Bots.CREATE',
					'ZohoCliq.Channels.READ',
				);
				expect(result).toBe(true);
			});
		});

		describe('when alias scope match', () => {
			it('should return true for legacy message/webhook aliases', () => {
				expect(hasRequiredScope('ZohoCliq.messages.CREATE', 'ZohoCliq.Messages.CREATE')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Webhooks.CREATE', 'ZohoCliq.Messages.CREATE')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Messages.CREATE', 'ZohoCliq.Webhooks.CREATE')).toBe(true);
			});

			it('should return true for applications scope casing aliases', () => {
				expect(
					hasRequiredScope('ZohoCliq.Applications.update', 'ZohoCliq.Applications.UPDATE'),
				).toBe(true);
				expect(
					hasRequiredScope('ZohoCliq.Applications.UPDATE', 'ZohoCliq.Applications.update'),
				).toBe(true);
			});

			it('should return true for profile to statuses aliases', () => {
				expect(hasRequiredScope('ZohoCliq.Statuses.CREATE', 'ZohoCliq.Profile.CREATE')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Statuses.READ', 'ZohoCliq.Profile.READ')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Statuses.UPDATE', 'ZohoCliq.Profile.UPDATE')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Statuses.DELETE', 'ZohoCliq.Profile.DELETE')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Profile.CREATE', 'ZohoCliq.Statuses.CREATE')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Profile.READ', 'ZohoCliq.Statuses.READ')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Profile.UPDATE', 'ZohoCliq.Statuses.UPDATE')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Profile.DELETE', 'ZohoCliq.Statuses.DELETE')).toBe(true);
			});

			it('should return true for attachments/files aliases', () => {
				expect(hasRequiredScope('ZohoCliq.Files.READ', 'ZohoCliq.Attachments.READ')).toBe(true);
				expect(hasRequiredScope('ZohoCliq.Attachments.READ', 'ZohoCliq.Files.READ')).toBe(true);
			});
		});

		describe('when scope not found', () => {
			it('should return false when scope not in list', () => {
				const result = hasRequiredScope('ZohoCliq.Channels.CREATE', 'ZohoCliq.Bots.CREATE');
				expect(result).toBe(false);
			});

			it('should return false for empty granted scopes', () => {
				const result = hasRequiredScope('', 'ZohoCliq.Channels.CREATE');
				expect(result).toBe(false);
			});

			it('should return false for empty required scope', () => {
				const result = hasRequiredScope('ZohoCliq.Channels.CREATE', '');
				expect(result).toBe(false);
			});

			it('should return false when both scopes are empty', () => {
				const result = hasRequiredScope('', '');
				expect(result).toBe(false);
			});

			it('should return false for partial match', () => {
				const result = hasRequiredScope('ZohoCliq.Channels.READ', 'ZohoCliq.Channels.CREATE');
				expect(result).toBe(false);
			});
		});

		describe('edge cases', () => {
			it('should not match wildcard from different resource', () => {
				const result = hasRequiredScope('ZohoCliq.Bots.ALL', 'ZohoCliq.Channels.CREATE');
				expect(result).toBe(false);
			});

			it('should derive wildcard provider from required scope', () => {
				const result = hasRequiredScope(
					'CustomProvider.Channels.ALL',
					'CustomProvider.Channels.CREATE',
				);
				expect(result).toBe(true);
			});

			it('should handle malformed scopes gracefully', () => {
				const result = hasRequiredScope('InvalidScope', 'ZohoCliq.Channels.CREATE');
				expect(result).toBe(false);
			});

			it('should return false for malformed required scope when deriving wildcard', () => {
				const result = hasRequiredScope('ZohoCliq.Channels.ALL', 'InvalidScope');
				expect(result).toBe(false);
			});

			it('should be case-sensitive', () => {
				const result = hasRequiredScope('zoho.channels.create', 'ZohoCliq.Channels.CREATE');
				expect(result).toBe(false);
			});

			it('should resolve aliases case-insensitively when required scope key casing differs', () => {
				const result = hasRequiredScope('ZohoCliq.Statuses.READ', 'zohocliq.profile.read', {
					caseInsensitive: true,
				});
				expect(result).toBe(true);
			});

			it('should handle case-insensitive mode when no alias mapping exists', () => {
				const result = hasRequiredScope('ZohoCliq.Bots.CREATE', 'zohocliq.unknown.read', {
					caseInsensitive: true,
				});
				expect(result).toBe(false);
			});
		});
	});
});
