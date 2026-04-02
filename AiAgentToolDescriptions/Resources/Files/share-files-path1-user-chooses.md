# Files: Share Files — Path 1: User Chooses Share Target

You have chosen the setup path where **you** decide in advance where files may be shared. In this path, **Share Target** is fixed during setup and only the matching target identifier input is available to the AI.

## Path 1 Manual Tool Settings

Set these manually for this path:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Set **Share Target** to one explicit destination such as `Chat`, `Channel (By ID)`, `Channel (By Unique Name)`, `Bot`, or `User`.
- Do not delegate **Share Target** to the agent in this path.
- Configure only the target identifier field that matches the manually selected **Share Target**.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Use this tool to share one or more existing files in Zoho Cliq to one fixed preconfigured target family. Use only the target identifier field that matches that fixed target family.

Each file entry must reference an existing file source. **Get File** returns `binary_handle_id`; map that value into each file entry's `binaryHandleId` field when reusing a downloaded file. Provide `binaryHandleId` in each file entry. Do not provide `binaryProperty` in file entries. This tool does not create file bytes from text.

Provide the matching target identifier for the fixed target family:
- fixed `Chat` target uses `Chat ID`
- fixed `Channel (By ID)` target uses `Channel`
- fixed `Channel (By Unique Name)` target uses `Channel Unique Name`
- fixed `Bot` target uses `Bot Unique Name`
- fixed `User` target uses `User Identifier Type` plus either `User ID` or `User Email`

When Post as Bot is true for a fixed channel target, also provide `Bot Unique Name` for the sender bot identity.

Successful responses return `success`, `resource`, `operation`, `share_target`, `target_identifier`, `file_count`, and any relevant `binary_properties` and/or `binary_handle_ids`, plus API response fields such as `data`, `request_count`, `user_ids`, or `results`.

Validation or API failures return structured error context with `error`, `resource`, `operation`, and target details such as `share_target`, `target_identifier`, `file_input_mode`, `binary_properties`, and `binary_handle_ids`.

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

### Channel ID (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq channel ID for this fixed Channel (By ID) target, for example P1234567890123456789. Do not pass channel unique name here, channel ID ONLY.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_id_explicit_target', 'Provide the exact Zoho Cliq channel ID for this fixed Channel (By ID) target, for example P1234567890123456789. Do not pass channel unique name here, channel ID ONLY.', 'string', '') }}
```

---

### Channel Unique Name (Optional)

- Plain text description:
```txt
Provide the exact channel unique name for this fixed Channel (By Unique Name) target, for example engineering-announcements. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_unique_name_explicit_target', 'Provide the exact channel unique name for this fixed Channel (By Unique Name) target, for example engineering-announcements. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### Chat ID (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq chat ID for this fixed Chat target, usually starting with CT_. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('chat_id_explicit_target', 'Provide the exact Zoho Cliq chat ID for this fixed Chat target, usually starting with CT_. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### User Identifier Type (Optional)

- Plain text description:
```txt
Choose whether this fixed User target should be identified by user ID or email. ENUM: ["userId", "email"].
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('buddy_identifier_type_explicit_target', 'Choose whether this fixed User target should be identified by user ID or email. ENUM: [\"userId\", \"email\"].', 'string', 'userId') }}
```

---

### User ID (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq user ID when this fixed User target uses `userId`. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('buddy_user_id_explicit_target', 'Provide the exact Zoho Cliq user ID when this fixed User target uses `userId`. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### User Email (Optional)

- Plain text description:
```txt
Provide the exact user email address when this fixed User target uses `email`. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('buddy_email_explicit_target', 'Provide the exact user email address when this fixed User target uses `email`. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### Post as Bot (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the fixed target is a channel target and the files should appear from a bot sender identity.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_as_bot_explicit_target', 'Optional boolean. Set true only when the fixed target is a channel target and the files should appear from a bot sender identity.', 'boolean', false) }}
```

---

### Bot Unique Name (Optional)

- Plain text description:
```txt
Provide the exact bot unique name when this fixed target is Bot, or when Post as Bot is true for a fixed channel target. Leave blank otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_unique_name_explicit_target', 'Provide the exact bot unique name when this fixed target is Bot, or when Post as Bot is true for a fixed channel target. Leave blank otherwise. Example bot unique name: helpdeskbot', 'string', '') }}
```

---

### Bot Display Name (Optional)

- Plain text description:
```txt
Optional custom sender display name for channel shares when Post as Bot is true. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_display_name_explicit_target', 'Optional custom sender display name for channel shares when Post as Bot is true. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### Bot Image URL (Optional)

- Plain text description:
```txt
Optional HTTP or HTTPS image URL for the bot sender avatar when Post as Bot is true for a channel target. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_image_url_explicit_target', 'Optional HTTP or HTTPS image URL for the bot sender avatar when Post as Bot is true for a channel target. Blank values are allowed and treated as omitted.', 'string', '') }}
```

---

### File Entries (JSON) (Required)

- Plain text description:
```txt
Required JSON array describing which files to share. Each entry should use `binaryHandleId` from an earlier **Get File** response. Do not provide `binaryProperty` in file entries. Optional `comment` is also supported. Example: [{"binaryHandleId":"opaque-handle","comment":"Quarterly report"}]. You can share up to 10 files at once, no more. The tool accepts either a stringified JSON array or a literal JSON array.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('file_entries_json_explicit_target', 'Required JSON array describing which files to share. Each entry should use binaryHandleId from an earlier Get File response. Do not provide binaryProperty in file entries. Optional comment is also supported. Example: [{\"binaryHandleId\":\"opaque-handle\",\"comment\":\"Quarterly report\"}]. You can share up to 10 files at once, no more. The tool accepts either a stringified JSON array or a literal JSON array.', 'string') }}
```

---

### Mark As Read (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the shared file message should be marked as read immediately for the current user. This setting applies to chat, channel, and direct-user targets, not bot targets.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('mark_as_read_explicit_target', 'Optional boolean. Set true only when the shared file message should be marked as read immediately for the current user. This setting applies to chat, channel, and direct-user targets, not bot targets.', 'boolean', false) }}
```

---

### Bot Subscriber User IDs (Optional)

- Plain text description:
```txt
Optional comma-separated Zoho Cliq user IDs for this fixed Bot target when the file share should fan out to specific existing bot subscribers. Blank values are allowed and treated as omitted. Leave blank to send one bot share request without a subscriber-specific `user_id`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_subscriber_user_ids_explicit_target', 'Optional comma-separated Zoho Cliq user IDs for this fixed Bot target when the file share should fan out to specific existing bot subscribers. Blank values are allowed and treated as omitted. Leave blank to send one bot share request without a subscriber-specific `user_id`.', 'string', '') }}
```
