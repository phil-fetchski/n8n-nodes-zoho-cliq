# Thread: Create Thread — Path 2: Agent's Choice

You have chosen the setup path where the **agent** decides the target family per tool call. The user manually sets **Target** to `Agent's Choice`, switches **Agent Selected Target** to expression mode, and configures every agent-choice identifier field with its provided optional `$fromAI()` expression so those inputs appear in the tool schema.

## Path 2 Manual Tool Settings

Set these manually for this path:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Set **Target** to `Agent's Choice`.
- Do not delegate **Target** to the agent in this path.
- Switch **Agent Selected Target** to expression mode and apply its provided `$fromAI()` expression.
- Configure every agent-choice identifier field with its provided optional `$fromAI()` expression so all supported target inputs appear in the tool schema.
- This path gives the AI broader routing access across `channel_id`, `channel_unique_name`, and `chat_id`. Enable it only when that level of access is intentional.
- The agent-choice **Bot Unique Name** input is shared. Use it only when **Post as Bot** is true for an agent-selected target.
- If **ZohoCliq.Chats.READ** is also granted, recoverable-mode `chat_id` calls can use the shared chat preflight for more precise invalid-chat guidance. Without that extra read scope, the operation still runs and the normal API path handles chat-target failures.
- Do not configure both path styles in the same tool.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Create one thread in Zoho Cliq with dynamic target choice per tool call. Provide `Agent Selected Target` plus only the matching target identifier field for that choice.

Choose exactly one target family:
- `channel_id` requires `Channel ID`
- `channel_unique_name` requires `Channel Unique Name`
- `chat_id` requires `Chat ID`

Provide `Thread Message ID` for the parent message that should start the thread.

Provide the configured content input for the first thread message:
- if Message Type is fixed to `text`, use the `Text` field for a normal plain-text message
- if Message Type is fixed to `json`, use the `JSON` field and include a non-empty top-level `text` string
- use `json` mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload_agent_choice` field

If `Post as Bot` is true, use `Bot Unique Name` for the sender bot identity.

Do not provide target identifier fields from multiple target families in the same tool call. The node rejects mismatched or extra target identifiers with a validation error.

Successful responses commonly return `message_id`, especially when `Sync Message` is enabled, and workflows can reuse that `message_id` for follow-up replies inside the new thread.

Use Retrieve Message, Get Messages, or List Threads after creation when the workflow needs the created thread conversation identifiers for follow-up Thread tools.

Example Response:
{
  "message_id": "1772612422798_209244327054"
}
```

## Suggested Field Setup

### Agent Selected Target (Required)

- Plain text description:
```txt
Required target family for this tool call. ENUM: ["channel_id", "channel_unique_name", "chat_id"]. You must also provide only the matching target identifier field for the selected target family.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_selected_target', 'Required target family for this tool call. ENUM: [\"channel_id\", \"channel_unique_name\", \"chat_id\"]. You must also provide only the matching target identifier field for the selected target family.', 'string') }}
```

---

### Channel ID (Optional)

- Plain text description:
```txt
Only provide the exact Zoho Cliq channel ID when Agent Selected Target is channel_id. Do not pass channel unique name here, channel ID ONLY. Leave blank for every other agent-selected target. Example channel ID: P1234567890123456789
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_channel_id', 'Only provide the exact Zoho Cliq channel ID when Agent Selected Target is channel_id. Do not pass channel unique name here, channel ID ONLY. Leave blank for every other agent-selected target. Example channel ID: P1234567890123456789', 'string', '') }}
```

---

### Channel Unique Name (Optional)

- Plain text description:
```txt
Only provide the exact channel unique name when Agent Selected Target is channel_unique_name. Leave blank for every other agent-selected target. Example channel unique name: engineeringannouncements
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_channel_unique_name', 'Only provide the exact channel unique name when Agent Selected Target is channel_unique_name. Leave blank for every other agent-selected target. Example channel unique name: engineeringannouncements', 'string', '') }}
```

---

### Chat ID (Optional)

- Plain text description:
```txt
Only provide the exact Zoho Cliq chat ID when Agent Selected Target is chat_id. This is not a channel ID. Leave blank for every other agent-selected target. Example chat ID: CT_1234567890_1234567890
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_chat_id', 'Only provide the exact Zoho Cliq chat ID when Agent Selected Target is chat_id. This is not a channel ID. Leave blank for every other agent-selected target. Example chat ID: CT_1234567890_1234567890', 'string', '') }}
```

---

### Thread Message ID (Required)

- Plain text description:
```txt
Required parent message ID that should start the new thread. Use the exact Zoho Cliq message ID from the original parent message.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('thread_message_id_agent_choice', 'Required parent message ID that should start the new thread. Use the exact Zoho Cliq message ID from the original parent message.', 'string') }}
```

---

### Message Type (Optional)

- Plain text description:
```txt
Optional message mode. ENUM: ["text", "json"]. Default `text`. Use `text` for normal plain-text thread messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_type_agent_choice', 'Optional message mode. ENUM: [\"text\", \"json\"]. Default `text`. Use `text` for normal plain-text thread messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.', 'string', 'text') }}
```

---

### Post as Bot (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the first thread message should appear from a bot sender identity for the selected target. Leave false otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_as_bot_agent_choice', 'Optional boolean. Set true only when the first thread message should appear from a bot sender identity for the selected target. Leave false otherwise.', 'boolean', false) }}
```

---

### Bot Unique Name (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq bot unique name (letters and numbers only) when Post as Bot is true for the selected target. Leave blank otherwise. Example bot unique name: helpdeskbot
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_target_bot_unique_name', 'Provide the exact Zoho Cliq bot unique name (letters and numbers only) when Post as Bot is true for the selected target. Leave blank otherwise. Example bot unique name: helpdeskbot', 'string', '') }}
```

---

### Text (Required)

- Plain text description:
```txt
Required when Message Type is `text`. Provide a non-empty string up to 5000 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type is `json`.
```
- Suggested `$fromAI()` when the user manually fixes Message Type to `text`:
```txt
{{ $fromAI('text_agent_choice', 'Required when Message Type is `text`. Provide a non-empty string up to 5000 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type is `json`.', 'string') }}
```
- Suggested `$fromAI()` when Message Type is AI-controlled:
```txt
{{ $fromAI('text_agent_choice', 'Required when Message Type is `text`. Populate this field only when Message Type resolves to `text`. Provide a non-empty string up to 5000 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type resolves to `json`.', 'string', '') }}
```

---

### JSON (Optional)

- Plain text description:
```txt
Required when Message Type is `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ "text": "...", "card": {...}, "slides": [...], "buttons": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool's `json_payload_agent_choice` field. Leave blank when Message Type is `text`.
```
- Suggested `$fromAI()` when the user manually fixes Message Type to `json`:
```txt
{{ $fromAI('json_payload_agent_choice', 'Required when Message Type is `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ \"text\": \"...\", \"card\": {...}, \"slides\": [...], \"buttons\": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool\'s `json_payload_agent_choice` field. Leave blank when Message Type is `text`.', 'string') }}
```
- Suggested `$fromAI()` when Message Type is AI-controlled:
```txt
{{ $fromAI('json_payload_agent_choice', 'Required when Message Type is `json`. Populate this field only when Message Type resolves to `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ \"text\": \"...\", \"card\": {...}, \"slides\": [...], \"buttons\": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool\'s `json_payload_agent_choice` field. Leave blank when Message Type resolves to `text`.', 'string', {}) }}
```

---

### Additional Fields > Thread Title (Optional)

- Plain text description:
```txt
Optional thread title. Use a short human-readable title when the thread should be easier to identify later. A Thread Title can only be assigned at time of creation, if not provided now it cannot be added or updated later. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('thread_title', 'Optional thread title. Use a short human-readable title when the thread should be easier to identify later. A Thread Title can only be assigned at time of creation, if not provided now it cannot be added or updated later. Leave blank to omit.', 'string', '') }}
```

---

### Additional Fields > Post In Parent (Optional)

- Plain text description:
```txt
Optional boolean. Set true to also post the first thread message into the parent conversation. Set false to keep that first message only inside the new thread.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_in_parent', 'Optional boolean. Set true to also post the first thread message into the parent conversation. Set false to keep that first message only inside the new thread.', 'boolean', false) }}
```

---

### Additional Fields > Sync Message (Optional)

- Plain text description:
```txt
Optional boolean. Set true when the workflow should wait for returned message metadata such as `message_id`. If set to false the response will not include the `message_id` for the created message.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sync_message', 'Optional boolean. Set true when the workflow should wait for returned message metadata such as `message_id`. If set to false the response will not include the `message_id` for the created message.', 'boolean', false) }}
```
