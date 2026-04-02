import * as addBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/addBot.operation';
import * as addMembers from '../../../../../../nodes/ZohoCliq/v1/actions/channel/addMembers.operation';
import * as approve from '../../../../../../nodes/ZohoCliq/v1/actions/channel/approve.operation';
import * as archive from '../../../../../../nodes/ZohoCliq/v1/actions/channel/archive.operation';
import * as changePermission from '../../../../../../nodes/ZohoCliq/v1/actions/channel/changePermission.operation';
import * as changeRole from '../../../../../../nodes/ZohoCliq/v1/actions/channel/changeRole.operation';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/channel/create.operation';
import * as channelDelete from '../../../../../../nodes/ZohoCliq/v1/actions/channel/delete.operation';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/channel/get.operation';
import * as getMembers from '../../../../../../nodes/ZohoCliq/v1/actions/channel/getMembers.operation';
import * as join from '../../../../../../nodes/ZohoCliq/v1/actions/channel/join.operation';
import * as leave from '../../../../../../nodes/ZohoCliq/v1/actions/channel/leave.operation';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/channel/list.operation';
import * as reject from '../../../../../../nodes/ZohoCliq/v1/actions/channel/reject.operation';
import * as removeBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeBot.operation';
import * as removeMember from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeMember.operation';
import * as removeMembers from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeMembers.operation';
import * as unarchive from '../../../../../../nodes/ZohoCliq/v1/actions/channel/unarchive.operation';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/channel/update.operation';
import { AI_AGENT_TOOL_DOC_LINKS } from '../../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

type OperationModule = {
	description: Array<{ displayName?: string; name?: string }>;
};

const cases: Record<keyof typeof AI_AGENT_TOOL_DOC_LINKS.channel, OperationModule> = {
	addBot,
	addMembers,
	approve,
	archive,
	changePermission,
	changeRole,
	create,
	delete: channelDelete,
	get,
	getMembers,
	join,
	leave,
	list,
	reject,
	removeBot,
	removeMember,
	removeMembers,
	unarchive,
	update,
};

describe('ZohoCliq - Channel - Description notices', () => {
	it.each(Object.entries(cases))(
		'should include docs notice and AI guide notice for %s',
		(key, mod) => {
			const typedKey = key as keyof typeof AI_AGENT_TOOL_DOC_LINKS.channel;
			const docsNoticeIndex = mod.description.findIndex(
				(item) => item.name?.toLowerCase().includes('docsnotice') === true,
			);
			const docsNotice = docsNoticeIndex >= 0 ? mod.description[docsNoticeIndex] : undefined;
			expect(docsNotice?.displayName).toContain('target="_blank" rel="noopener noreferrer"');
			expect(docsNotice?.displayName).toContain('REQUIRED SCOPES:');

			const aiNoticeIndex = mod.description.findIndex(
				(item) => item.name?.toLowerCase().includes('aitoolguide') === true,
			);
			const aiNotice = aiNoticeIndex >= 0 ? mod.description[aiNoticeIndex] : undefined;
			expect(aiNotice?.displayName).toContain(AI_AGENT_TOOL_DOC_LINKS.channel[typedKey]);
			expect(aiNotice?.displayName).toContain('Open Tool Setup Guide');
			expect(docsNoticeIndex).toBe(aiNoticeIndex - 1);
		},
	);

	it('should keep workflow selector modes for get while documenting AI Tool channel ID requirement', () => {
		const channelField = get.description.find((item) => item.name === 'channelId');
		expect(channelField?.description).toContain(
			'Workflow mode supports list, channel ID, or unique name',
		);
		expect(channelField?.description).toContain(
			'AI Tool mode must pass channel_id as the channel ID string only',
		);
		expect(channelField?.description).toContain('P5452022000000451001');
		expect((channelField as { modes?: Array<{ name?: string }> } | undefined)?.modes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'list' }),
				expect.objectContaining({ name: 'id' }),
				expect.objectContaining({ name: 'name' }),
			]),
		);
	});

	it('should keep workflow selector modes for changeRole while documenting AI Tool channel ID requirement', () => {
		const channelField = changeRole.description.find((item) => item.name === 'channelId');
		expect(channelField?.description).toContain(
			'Workflow mode supports list, channel ID, or unique name',
		);
		expect(channelField?.description).toContain(
			'AI Tool mode must pass channel_id as the channel ID string only',
		);
		expect(channelField?.description).toContain(
			'Do not use channel unique name or display name in AI Tool mode.',
		);
		expect((channelField as { modes?: Array<{ name?: string }> } | undefined)?.modes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'list' }),
				expect.objectContaining({ name: 'id' }),
				expect.objectContaining({ name: 'name' }),
			]),
		);
	});

	it('should block expressions for changePermission input mode selectors', () => {
		for (const fieldName of ['adminInputMode', 'moderatorInputMode', 'memberInputMode']) {
			const field = changePermission.description.find((item) => item.name === fieldName);
			expect(field).toEqual(expect.objectContaining({ noDataExpression: true }));
		}
	});

	it('should block expressions for channel config input mode selectors', () => {
		// create: configInputMode is a top-level field
		const createField = create.description.find((item) => item.name === 'configInputMode');
		expect(createField).toEqual(expect.objectContaining({ noDataExpression: true }));

		// update: configInputMode is inside additionalFields
		const updateCollectionField = update.description.find(
			(item) => item.name === 'additionalFields',
		) as { options?: Array<{ name?: string; noDataExpression?: boolean }> } | undefined;
		const updateField = updateCollectionField?.options?.find(
			(item) => item.name === 'configInputMode',
		);
		expect(updateField).toEqual(expect.objectContaining({ noDataExpression: true }));
	});
});
