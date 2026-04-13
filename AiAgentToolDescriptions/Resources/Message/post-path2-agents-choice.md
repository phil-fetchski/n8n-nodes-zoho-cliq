# Message: Post Message — Path 2: Agent's Choice

You have chosen the setup path where the **agent** decides the destination family per tool call. The user manually sets **Target** to `Agent's Choice`, switches **Agent Selected Target** to expression mode, and configures every agent-choice identifier field with its provided optional `$fromAI()` expression so those inputs appear in the tool schema.

## Path 2 Manual Tool Settings

Set these manually for this path:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Set **Target** to `Agent's Choice`.
- Do not delegate **Target** to the agent in this path.
- Switch **Agent Selected Target** to expression mode and apply its provided `$fromAI()` expression.
- Configure every agent-choice identifier field with its provided optional `$fromAI()` expression so all supported target inputs appear in the tool schema.
- This path gives the AI broader routing access across channels, chats, threads, bots, and users. Enable it only when that level of access is intentional.
- The agent-choice **Bot Unique Name** input is shared. Use it when Agent Selected Target is `bot`, or as the sender bot identity when **Post as Bot** is enabled for agent-selected `channelId`, `channelUniqueName`, or `chat`.
- Keep **Include Enhanced Output** enabled when agent-selected `channelId` or `channelUniqueName` posts should also return `posted_to_channel.chat_id` for follow-up Message tools.
- Do not configure both path styles in the same tool.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Post one message in Zoho Cliq with dynamic target choice per tool call. Provide `Agent Selected Target` plus only the matching target identifier field or fields for that choice.

Choose exactly one target family:
- `channelId` requires `Channel ID`
- `channelUniqueName` requires `Channel Unique Name`
- `bot` requires the target `Bot Unique Name`
- `chat` requires `Chat ID`
- `thread` requires `Thread Chat ID` plus `Thread ID`
- `user` requires `Email ID / ZUID` and sends a direct message from the authenticated Zoho Cliq user to that recipient

The message content field is configured by the user during setup:
- if the `Text` field is available, provide a non-empty plain-text string up to 5000 characters
- if the `JSON` field is available, provide a raw JSON message object with a non-empty top-level `text` string — used mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload_agent_choice` field

If Agent Selected Target is `bot`, provide `Bot Unique Name` for the bot conversation. If `Post as Bot` is true and Agent Selected Target is `channelId`, `channelUniqueName`, or `chat`, use that same `Bot Unique Name` field for the sender bot identity. Do not use `Post as Bot` for agent-selected `bot`, `thread`, or `user` targets.

Do not provide target identifier fields from multiple target families in the same tool call. The node rejects mismatched or extra target identifiers with a validation error.

Use `Reply To Message ID` only when replying to an existing message. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message.

Successful responses vary by target family:
- without `Sync Message`, many target families can return sparse or empty success responses by default
- with `Sync Message` enabled, workflows can commonly reuse `response[0].message_id` for chaining
- `bot` targets can return bot-delivery metadata such as `response[0].user_ids` and `response[0].message_details`
- when Agent Selected Target is `channelId` or `channelUniqueName`, the response can also include `posted_to_channel.channel_id`, `posted_to_channel.chat_id`, `posted_to_channel.unique_name`, and `posted_to_channel.level` for follow-up Message tools
- when posting to a channel, reuse `posted_to_channel.chat_id` for follow-up tools that require Chat ID, such as Edit Message, Delete Message, Retrieve Message, and Get Messages
- when a reply creates or continues a thread, the response can also include `thread_information.parent_message_id`, the original composite `thread_information.chat_id`, and split-ready `thread_information.thread_chat_id` plus `thread_information.thread_id` for follow-up thread target calls

Example Response (agent-selected chat target with `Sync Message` enabled):
[
  {
    "message_id": "1772612422798_209244327054"
  }
]

Example Response (agent-selected `channelId` or `channelUniqueName` target):
[
  {
    "message_id": "1772612422798_209244327054",
    "posted_to_channel": {
      "channel_id": "P1234567890123456789",
      "chat_id": "CT_1234567890_1234567890",
      "unique_name": "engineeringannouncements",
      "level": "organization"
    }
  }
]

Example Response (agent-selected reply that created or continued a thread):
[
  {
    "message_id": "1773603764498_227899757499",
    "thread_information": {
      "parent_message_id": "1773603764498_227899757498",
      "chat_id": "CT_2242141513167369284_841692385-T-1424728043674064115",
      "thread_chat_id": "CT_2242141513167369284_841692385",
      "thread_id": "T-1424728043674064115"
    }
  }
]

Example Response (agent-selected bot target):
[
  {
    "user_ids": ["55743307", "55622727"],
    "message_details": {
      "55622727": {
        "chat_id": "CT_1203304812000146098_55622663-B2",
        "message_id": "1709038327622_29706114886"
      }
    }
  }
]
```

## Suggested Field Setup

### Agent Selected Target (Required)

- Plain text description:
```txt
Required target family for this tool call. ENUM: ["channelId", "channelUniqueName", "bot", "chat", "thread", "user"]. You must also provide only the matching target identifier field or fields for the selected target family.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_selected_target', 'Required target family for this tool call. ENUM: [\"channelId\", \"channelUniqueName\", \"bot\", \"chat\", \"thread\", \"user\"]. You must also provide only the matching target identifier field or fields for the selected target family.', 'string') }}
```

---

### Channel ID (Optional)

- Plain text description:
```txt
Only provide the exact Zoho Cliq channel ID when Agent Selected Target is channelId. Do not pass channel unique name here, channel ID ONLY. Leave blank for every other agent-selected target. Example channel ID: P1234567890123456789
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_channel_id', 'Only provide the exact Zoho Cliq channel ID when Agent Selected Target is channelId. Do not pass channel unique name here, channel ID ONLY. Leave blank for every other agent-selected target. Example channel ID: P1234567890123456789', 'string', '') }}
```

---

### Channel Unique Name (Optional)

- Plain text description:
```txt
Only provide the exact channel unique name when Agent Selected Target is channelUniqueName. Leave blank for every other agent-selected target. Example channel unique name: engineeringannouncements
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_channel_unique_name', 'Only provide the exact channel unique name when Agent Selected Target is channelUniqueName. Leave blank for every other agent-selected target. Example channel unique name: engineeringannouncements', 'string', '') }}
```

---

### Bot Unique Name (Optional)

- Plain text description:
```txt
Only provide the exact Zoho Cliq bot unique name when Agent Selected Target is `bot`, or when Post as Bot is true and Agent Selected Target is `channelId`, `channelUniqueName`, or `chat`. Leave blank otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_target_bot_unique_name', 'Only provide the exact Zoho Cliq bot unique name when Agent Selected Target is `bot`, or when Post as Bot is true and Agent Selected Target is `channelId`, `channelUniqueName`, or `chat`. Leave blank otherwise. Example bot unique name: helpdeskbot', 'string', '') }}
```

---

### Chat ID (Optional)

- Plain text description:
```txt
Only provide the exact Zoho Cliq chat ID when Agent Selected Target is chat. Leave blank for every other agent-selected target. Example chat ID: CT_1234567890_1234567890
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_chat_id', 'Only provide the exact Zoho Cliq chat ID when Agent Selected Target is chat. Leave blank for every other agent-selected target. Example chat ID: CT_1234567890_1234567890', 'string', '') }}
```

---

### Thread Chat ID (Optional)

- Plain text description:
```txt
Only provide the exact chat ID that contains the target thread when Agent Selected Target is thread. Use a channel chat_id here when posting into a channel thread. Leave blank for every other agent-selected target.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_thread_chat_id', 'Only provide the exact chat ID that contains the target thread when Agent Selected Target is thread. Use a channel chat_id here when posting into a channel thread. Leave blank for every other agent-selected target.', 'string', '') }}
```

---

### Thread ID (Optional)

- Plain text description:
```txt
Only provide the exact thread ID when Agent Selected Target is thread. Leave blank for every other agent-selected target.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_thread_id', 'Only provide the exact thread ID when Agent Selected Target is thread. Leave blank for every other agent-selected target.', 'string', '') }}
```

---

### Email ID / ZUID (Optional)

- Plain text description:
```txt
Only provide one valid Zoho Cliq user email address or ZUID when Agent Selected Target is user. This sends a direct message from the authenticated Zoho Cliq user to that recipient. Leave blank for every other agent-selected target. Example email: jane@example.com. Example ZUID: 839367970
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('agent_email_or_zuid', 'Only provide one valid Zoho Cliq user email address or ZUID when Agent Selected Target is user. This sends a direct message from the authenticated Zoho Cliq user to that recipient. Leave blank for every other agent-selected target. Example email: jane@example.com. Example ZUID: 839367970', 'string', '') }}
```

---

### Post as Bot (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when Agent Selected Target is channelId, channelUniqueName, or chat and the message should appear from a bot sender identity. Leave false for agent-selected bot, thread, and user targets.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_as_bot_agent_choice', 'Optional boolean. Set true only when Agent Selected Target is channelId, channelUniqueName, or chat and the message should appear from a bot sender identity. Leave false for agent-selected bot, thread, and user targets.', 'boolean', false) }}
```

---

### Text (Required — Text setup only)

Only configure this field when **Message Type** is set to `Text (Cliq Markdown)`. Skip this section entirely for `Advanced (JSON)` setup.

- Plain text description:
```txt
Provide a non-empty string up to 5000 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('text_agent_choice', 'Provide a non-empty string up to 5000 characters. Limited Cliq markdown guidance for AI use: `*bold*`, `_italics_`, `~strike~`, `` `inline code` ``, triple-backtick code blocks, and `[label](https://example.com)` links.', 'string') }}
```

---

### JSON (Required — JSON setup only)

Only configure this field when **Message Type** is set to `Advanced (JSON)`. Skip this section entirely for `Text (Cliq Markdown)` setup.

- Plain text description:
```txt
Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ "text": "...", "card": {...}, "slides": [...], "buttons": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool's `json_payload_agent_choice` field.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('json_payload_agent_choice', 'Provide a raw JSON message object as a literal JSON object or a stringified JSON object. The payload must include a non-empty top-level `text` string. Use this mode mainly for card payloads such as `{ \"text\": \"...\", \"card\": {...}, \"slides\": [...], \"buttons\": [...] }`. If a structured card payload is needed and the tool is available, prefer building it first with `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and pass that returned object into this tool\'s `json_payload_agent_choice` field.', 'string') }}
```

---

### Optional Fields > Mark as Read (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the posted message should also be marked as read. This is relevant for agent-selected channelId, channelUniqueName, chat, thread, and user targets. Agent-selected bot-target calls ignore it.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('mark_as_read_agent_choice', 'Optional boolean. Set true only when the posted message should also be marked as read. This is relevant for agent-selected channelId, channelUniqueName, chat, thread, and user targets. Agent-selected bot-target calls ignore it.', 'boolean', false) }}
```

---

### Optional Fields > Reply To Message ID (Optional)

- Plain text description:
```txt
Optional message identifier to reply to inside the selected conversation. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message. Leave blank when not replying.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('reply_to_agent_choice', 'Optional message identifier to reply to inside the selected conversation. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message. Leave blank when not replying.', 'string', '') }}
```

---

### Optional Fields > Sync Message (Optional)

- Plain text description:
```txt
Optional boolean. Set true when the workflow needs returned created-message metadata such as `message_id`. Works for all target families and is recommended whenever the workflow needs `message_id` or other message metadata in the response. Without it, most targets return sparse or empty responses by default.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sync_message_agent_choice', 'Optional boolean. Set true when the workflow needs returned created-message metadata such as `message_id`. Works for all target families and is recommended whenever the workflow needs `message_id` or other message metadata in the response. Without it, most targets return sparse or empty responses by default.', 'boolean', false) }}
```
