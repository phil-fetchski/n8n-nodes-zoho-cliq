# Thread: Create Thread — Path 1: User Chooses Target

You have chosen the setup path where **you** decide in advance which target family may be used to create threads. In this path, **Target** is fixed during setup and only the matching target identifier input is available to the AI.

## Path 1 Manual Tool Settings

Set these manually for this path:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Set **Target** to one explicit destination such as `Channel`, `Channel (By Unique Name)`, or `Chat`.
- Do not delegate **Target** to the agent in this path.
- Configure only the target identifier field that matches the manually selected **Target**.
- If the fixed target is `Channel`, use the **Channel** field in `From List` mode or `By ID` mode. Do not use `By Unique Name` in this path.
- If the fixed target is `Channel (By Unique Name)`, use **Channel Unique Name** and do not also configure **Channel**.
- If the fixed target is `Chat`, configure **Chat ID**. If **ZohoCliq.Chats.READ** is also granted, recoverable-mode calls can preflight that chat ID before the create request; otherwise the operation still proceeds through the normal API path.
- The fixed-path **Bot Unique Name** input is shared. Use it only when **Post as Bot** is true for the fixed target.
- Do not configure both path styles in the same tool.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Use this tool to create one thread in Zoho Cliq from one existing parent message in one fixed preconfigured target family. Use only the target identifier field that matches that fixed target family.

Provide exactly one fixed target identifier:
- fixed `Channel` target uses `Channel`
- fixed `Channel (By Unique Name)` target uses `Channel Unique Name`
- fixed `Chat` target uses `Chat ID`

Provide `Thread Message ID` for the parent message that should start the thread.

Provide the configured content input for the first thread message:
- if Message Type is fixed to `text`, use the `Text` field for a normal plain-text message
- if Message Type is fixed to `json`, use the `JSON` field and include a non-empty top-level `text` string
- use `json` mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload_fixed_target` field

If `Post as Bot` is true, use `Bot Unique Name` for the sender bot identity.

Successful responses commonly return `message_id`, especially when `Sync Message` is enabled, and workflows can reuse that `message_id` for follow-up replies inside the new thread.

Use Retrieve Message, Get Messages, or List Threads after creation when the workflow needs the created thread conversation identifiers for follow-up Thread tools.

Example Response:
{
  "message_id": "1772612422798_209244327054"
}
```

## Suggested Field Setup

### Channel (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq channel ID for this fixed Channel target. Do not pass channel unique name here, channel ID ONLY. Leave blank for every other fixed target. Example channel ID: P1234567890123456789
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_channel_id', 'Provide the exact Zoho Cliq channel ID for this fixed Channel target. Do not pass channel unique name here, channel ID ONLY. Leave blank for every other fixed target. Example channel ID: P1234567890123456789', 'string', '') }}
```

---

### Channel Unique Name (Optional)

- Plain text description:
```txt
Provide the exact channel unique name for this fixed Channel (By Unique Name) target. Leave blank for every other fixed target. Example channel unique name: engineeringannouncements
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_channel_unique_name', 'Provide the exact channel unique name for this fixed Channel (By Unique Name) target. Leave blank for every other fixed target. Example channel unique name: engineeringannouncements', 'string', '') }}
```

---

### Chat ID (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq chat ID for this fixed Chat target. This is not a channel ID. Leave blank for every other fixed target. Example chat ID: CT_1234567890_1234567890
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_chat_id', 'Provide the exact Zoho Cliq chat ID for this fixed Chat target. This is not a channel ID. Leave blank for every other fixed target. Example chat ID: CT_1234567890_1234567890', 'string', '') }}
```

---

### Thread Message ID (Required)

- Plain text description:
```txt
Required parent message ID that should start the new thread. Use the exact Zoho Cliq message ID from the original parent message.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('thread_message_id_fixed_target', 'Required parent message ID that should start the new thread. Use the exact Zoho Cliq message ID from the original parent message.', 'string') }}
```

---

### Message Type (Optional)

- Plain text description:
```txt
Optional message mode. ENUM: ["text", "json"]. Default `text`. Use `text` for normal plain-text thread messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_type_fixed_target', 'Optional message mode. ENUM: [\"text\", \"json\"]. Default `text`. Use `text` for normal plain-text thread messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.', 'string', 'text') }}
```

---

### Post as Bot (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the fixed target is Channel, Channel (By Unique Name), or Chat and the first thread message should appear from a bot sender identity. Leave false otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_as_bot_fixed_target', 'Optional boolean. Set true only when the fixed target is Channel, Channel (By Unique Name), or Chat and the first thread message should appear from a bot sender identity. Leave false otherwise.', 'boolean', false) }}
```

---

### Bot Unique Name (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq bot unique name (letters and numbers only) when Post as Bot is true for a fixed Channel, fixed Channel (By Unique Name), or fixed Chat target. Leave blank otherwise. Example bot unique name: helpdeskbot
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_bot_unique_name', 'Provide the exact Zoho Cliq bot unique name (letters and numbers only) when Post as Bot is true for a fixed Channel, fixed Channel (By Unique Name), or fixed Chat target. Leave blank otherwise. Example bot unique name: helpdeskbot', 'string', '') }}
```

---

### Text (Required)

- Plain text description:
```txt
Required when Message Type is `text`. Provide a non-empty string up to 5000 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type is `json`.
```
- Suggested `$fromAI()` when the user manually fixes Message Type to `text`:
```txt
{{ $fromAI('text_fixed_target', 'Required when Message Type is `text`. Provide a non-empty string up to 5000 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type is `json`.', 'string') }}
```
- Suggested `$fromAI()` when Message Type is AI-controlled:
```txt
{{ $fromAI('text_fixed_target', 'Required when Message Type is `text`. Populate this field only when Message Type resolves to `text`. Provide a non-empty string up to 5000 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links. Leave blank when Message Type resolves to `json`.', 'string', '') }}
```

---

### JSON (Optional)

- Plain text description:
```txt
Required when Message Type is `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ "text": "...", "card": {...}, "slides": [...], "buttons": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool's `json_payload_fixed_target` field. Leave blank when Message Type is `text`.
```
- Suggested `$fromAI()` when the user manually fixes Message Type to `json`:
```txt
{{ $fromAI('json_payload_fixed_target', 'Required when Message Type is `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ \"text\": \"...\", \"card\": {...}, \"slides\": [...], \"buttons\": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool\'s `json_payload_fixed_target` field. Leave blank when Message Type is `text`.', 'string') }}
```
- Suggested `$fromAI()` when Message Type is AI-controlled:
```txt
{{ $fromAI('json_payload_fixed_target', 'Required when Message Type is `json`. Populate this field only when Message Type resolves to `json`. Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ \"text\": \"...\", \"card\": {...}, \"slides\": [...], \"buttons\": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool\'s `json_payload_fixed_target` field. Leave blank when Message Type resolves to `text`.', 'string', {}) }}
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
Optional boolean. Set true when the workflow should wait for returned message metadata such as `message_id`. Set false for default send behavior.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sync_message', 'Optional boolean. Set true when the workflow should wait for returned message metadata such as `message_id`. Set false for default send behavior.', 'boolean', false) }}
```
