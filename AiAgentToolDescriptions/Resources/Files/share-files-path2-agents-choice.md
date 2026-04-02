# Files: Share Files — Path 2: Agent's Choice

You have chosen the setup path where the **agent** decides the destination family per tool call. The user manually sets **Share Target** to `Agent's Choice`, switches **Agent Selected Share Target** to expression mode, and configures every target identifier field with its provided optional `$fromAI()` expression so those inputs are present in the tool schema.

## Path 2 Manual Tool Settings

Set these manually for this path:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Set **Share Target** to `Agent's Choice`.
- Do not delegate **Share Target** to the agent in this path.
- Switch **Agent Selected Share Target** to expression mode and apply its provided `$fromAI()` expression.
- Configure every target identifier field with its provided optional `$fromAI()` expression so all supported target inputs appear in the tool schema.
- This path gives the AI broader routing access across chats, channels, bots, and users. Enable it only when that level of access is intentional.
- Do not configure both path styles in the same tool.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Share one or more existing binary files in Zoho Cliq with dynamic destination choice per tool call. Provide `Agent Selected Share Target` plus only the matching target identifier field or fields for that choice.

Use `binaryHandleId` from **Get File** for each file entry. Do not provide `binaryProperty` in file entries. This tool does not create file bytes from text.

Choose one target family only:
- `chat` requires `Chat ID`
- `channelId` requires `Channel ID`
- `channelUniqueName` requires `Channel Unique Name`
- `bot` requires `Bot Unique Name`
- `buddy` requires **EITHER** `User ID` **OR** `User Email` **NOT BOTH**

When Agent Selected Share Target is `channelId` or `channelUniqueName` and Post as Bot is true, also provide `Bot Unique Name` for the sender bot identity.

Do not provide target identifier fields from multiple target families in the same tool call. The node rejects mismatched or extra target identifiers with a validation error.

Successful responses return `success`, `resource`, `operation`, `share_target`, `target_identifier`, `file_count`, and any relevant `binary_properties` and/or `binary_handle_ids`, plus API response fields such as `data`, `request_count`, `user_ids`, or `results`.

Validation or API failures return structured error context with `error`, `resource`, `operation`, and routing details such as `share_target_selection`, `agent_selected_share_target`, `share_target`, `target_identifier`, `file_input_mode`, `binary_properties`, and `binary_handle_ids`.

You can share up to 10 files at once, no more.

Example Response:
{
  data: "",
  success: true,
  resource: "files",
  operation: "shareFile",
  share_target: "chat",
  target_identifier: "CT_1234567890_1234567890",
  file_count: 1,
  binary_properties: ["data"],
  mark_as_read: false
}
```

## Suggested Field Setup

### Agent Selected Share Target (Required)

- Plain text description:
```txt
Required target family for this tool call. ENUM: ["chat", "channelId", "channelUniqueName", "bot", "buddy"]. You must also provide only the matching target identifier field or fields for the selected target family.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_selected_share_target', 'Required target family for this tool call. ENUM: [\"chat\", \"channelId\", \"channelUniqueName\", \"bot\", \"buddy\"]. You must also provide only the matching target identifier field or fields for the selected target family.', 'string') }}
```

---

### Post as Bot (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the selected target is a channel target and the files should appear from a bot sender identity.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_as_bot_agent_choice', 'Optional boolean. Set true only when the selected target is a channel target and the files should appear from a bot sender identity.', 'boolean', false) }}
```

---

### Bot Unique Name (Optional)

- Plain text description:
```txt
Provide the exact bot unique name when Agent Selected Share Target is bot, or when Agent Selected Share Target is channelId/channelUniqueName and Post as Bot is true. Leave blank otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_bot_unique_name', 'Provide the exact bot unique name when Agent Selected Share Target is bot, or when Agent Selected Share Target is channelId/channelUniqueName and Post as Bot is true. Leave blank otherwise. Example bot unique name: helpdeskbot', 'string', '') }}
```

---

### Channel ID (Optional)

- Plain text description:
```txt
Only provide the exact Zoho Cliq channel ID when Agent Selected Share Target is channelId. Do not pass channel unique name here, channel ID ONLY. Leave blank for every other agent-selected target.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_channel_id', 'Only provide the exact Zoho Cliq channel ID when Agent Selected Share Target is channelId. Do not pass channel unique name here, channel ID ONLY. Leave blank for every other agent-selected target. Example channel ID: P1234567890123456789', 'string', '') }}
```

---

### Channel Unique Name (Optional)

- Plain text description:
```txt
Only provide the exact channel unique name when Agent Selected Share Target is channelUniqueName. Leave blank for every other agent-selected target.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_channel_unique_name', 'Only provide the exact channel unique name when Agent Selected Share Target is channelUniqueName. Leave blank for every other agent-selected target. Example channel unique name: engineering-announcements', 'string', '') }}
```

---

### Chat ID (Optional)

- Plain text description:
```txt
Only provide the exact Zoho Cliq chat ID when Agent Selected Share Target is chat. Leave blank for every other agent-selected target.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_chat_id', 'Only provide the exact Zoho Cliq chat ID when Agent Selected Share Target is chat. Leave blank for every other agent-selected target. Example chat ID: CT_1234567890_1234567890', 'string', '') }}
```

---

### User ID (Optional)

- Plain text description:
```txt
Only provide the exact Zoho Cliq user ID when Agent Selected Share Target is buddy and the recipient should be identified by user ID. Leave blank for every other agent-selected target. Do not provide this together with User Email.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_buddy_user_id', 'Only provide the exact Zoho Cliq user ID when Agent Selected Share Target is buddy and the recipient should be identified by user ID. Leave blank for every other agent-selected target. Do not provide this together with User Email.', 'string', '') }}
```

---

### User Email (Optional)

- Plain text description:
```txt
Only provide the exact user email when Agent Selected Share Target is buddy and the recipient should be identified by email address. Leave blank for every other agent-selected target. Do not provide this together with User ID.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_buddy_email', 'Only provide the exact user email when Agent Selected Share Target is buddy and the recipient should be identified by email address. Leave blank for every other agent-selected target. Do not provide this together with User ID.', 'string', '') }}
```

---

### File Entries (JSON) (Required)

- Plain text description:
```txt
Required JSON array describing which files to share. Each entry should use `binaryHandleId` from an earlier **Get File** response. Do not provide `binaryProperty` in file entries. Optional `comment` is also supported. Example: [{"binaryHandleId":"opaque-handle","comment":"Quarterly report"}]. You can share up to 10 files at once, no more. The tool accepts either a stringified JSON array or a literal JSON array.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('file_entries_json_agent_choice', 'Required JSON array describing which files to share. Each entry should use binaryHandleId from an earlier Get File response. Do not provide binaryProperty in file entries. Optional comment is also supported. Example: [{\"binaryHandleId\":\"opaque-handle\",\"comment\":\"Quarterly report\"}]. You can share up to 10 files at once, no more. The tool accepts either a stringified JSON array or a literal JSON array.', 'string') }}
```

---

### Mark As Read (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the shared file message should be marked as read immediately for the current user. This setting is relevant for chat, channel, and direct-user targets. Bot-target calls ignore it.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('mark_as_read_agent_choice', 'Optional boolean. Set true only when the shared file message should be marked as read immediately for the current user. This setting is relevant for chat, channel, and direct-user targets. Bot-target calls ignore it.', 'boolean', false) }}
```

---

### Bot Subscriber User IDs (Optional)

- Plain text description:
```txt
Optional comma-separated Zoho Cliq user IDs for bot-target file shares to specific existing bot subscribers. Use this only when Agent Selected Share Target is bot. Blank values are allowed and treated as omitted. Leave blank to send one bot share request without a subscriber-specific user_id.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_subscriber_user_ids_agent_choice', 'Optional comma-separated Zoho Cliq user IDs for bot-target file shares to specific existing bot subscribers. Use this only when Agent Selected Share Target is bot. Blank values are allowed and treated as omitted. Leave blank to send one bot share request without a subscriber-specific user_id.', 'string', '') }}
```
