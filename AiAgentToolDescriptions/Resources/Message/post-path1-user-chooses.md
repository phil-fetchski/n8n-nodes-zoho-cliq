# Message: Post Message — Path 1: User Chooses Target

You have chosen the setup path where **you** decide in advance exactly where the agent may post messages. In this path, **Target** is fixed during setup and only the matching target identifier input is available to the AI.

## Path 1 Manual Tool Settings

Set these manually for this path:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Set **Target** to one explicit destination such as `Channel`, `Bot`, `Chat`, `Thread`, or `User`.
- Do not delegate **Target** to the agent in this path.
- Configure only the target identifier field that matches the manually selected **Target**.
- The fixed-path **Bot Unique Name** input is shared. Use it for the bot conversation itself when the fixed target is `Bot`, or for the sender bot identity when **Post as Bot** is enabled for a fixed `Channel` or `Chat` target.
- If the fixed target is `Channel`, keep **Include Enhanced Output** enabled when the workflow should also receive `posted_to_channel.chat_id` for later Edit/Delete/Retrieve Message calls.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Use this tool to post one message in Zoho Cliq to one fixed preconfigured target family. Use only the target identifier field that matches that fixed target family.

Provide exactly one fixed target identifier:
- fixed `Channel` target uses `Channel`
- fixed `Bot` target uses the target `Bot Unique Name`
- fixed `Chat` target uses `Chat ID`
- fixed `Thread` target uses `Chat ID` plus `Thread ID`
- fixed `User` target uses `Email ID / ZUID` and sends a direct message from the authenticated Zoho Cliq user to that recipient

Provide `Message Type` as either `text` or `json`:
- `text` uses the `Text` field for a normal plain-text message
- `json` uses the `JSON` field and must include a non-empty top-level `text` string
- use `json` mainly for card payloads such as `text` + `card` / `slides` / `buttons`
- if a structured Zoho Cliq card payload is needed and the tool is available, first call `Build_an_agent-ready_card_payload_in_Zoho_Cliq` and then pass its returned object into this tool's `json_payload_fixed_target` field

If the fixed target is `Bot`, provide `Bot Unique Name` for the bot conversation. If the fixed target is `Channel` or `Chat` and `Post as Bot` is true, use that same `Bot Unique Name` field for the sender bot identity. Do not use `Post as Bot` for fixed `Bot`, `Thread`, or `User` targets.

Use `Reply To Message ID` only when replying to an existing message. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message.

Successful responses vary by target family:
- without `Sync Message`, many target families can return sparse or empty success responses by default
- with `Sync Message` enabled, workflows can commonly reuse `response[0].message_id` for chaining
- fixed `Bot` targets can return bot-delivery metadata such as `response[0].user_ids` and `response[0].message_details`
- when the fixed target uses Channel ID or Channel Unique Name, the response can also include `posted_to_channel.channel_id`, `posted_to_channel.chat_id`, `posted_to_channel.unique_name`, and `posted_to_channel.level` for follow-up Message tools
- when posting to a channel, reuse `posted_to_channel.chat_id` for follow-up tools that require Chat ID, such as Edit Message, Delete Message, Retrieve Message, and Get Messages
- when a reply creates or continues a thread, the response can also include `thread_information.parent_message_id`, the original composite `thread_information.chat_id`, and split-ready `thread_information.thread_chat_id` plus `thread_information.thread_id` for follow-up thread target calls

Example Response (fixed chat target with `Sync Message` enabled):
[
  {
    "message_id": "1772612422798_209244327054"
  }
]

Example Response (fixed channel target using Channel ID or Channel Unique Name):
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

Example Response (fixed reply that created or continued a thread):
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

Example Response (fixed bot target):
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

### Channel (Optional)

- Plain text description:
```txt
Provide the exact channel ID or channel unique name for this fixed Channel target. Match the selected locator mode. Do not use this field for thread posting. For channel threads, use a fixed Thread target or a fixed Chat target with Post to Thread.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_channel', 'Provide the exact channel ID or channel unique name for this fixed Channel target. Match the selected locator mode. Do not use this field for thread posting. For channel threads, use a fixed Thread target or a fixed Chat target with Post to Thread.', 'string', '') }}
```

---

### Bot Unique Name (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq bot unique name when the fixed target is `Bot`, or when Post as Bot is true for a fixed `Channel` or fixed `Chat` target. Use letters and numbers only. Leave blank otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_bot_unique_name', 'Provide the exact Zoho Cliq bot unique name when the fixed target is `Bot`, or when Post as Bot is true for a fixed `Channel` or fixed `Chat` target. Use letters and numbers only. Leave blank otherwise. Example bot unique name: helpdeskbot', 'string', '') }}
```

---

### Broadcast (Optional)

- Plain text description:
```txt
Use this only when the fixed target is Bot. Set true to send the message to all bot subscribers. Set false to target specific Bot Subscriber User IDs instead.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_broadcast', 'Use this only when the fixed target is Bot. Set true to send the message to all bot subscribers. Set false to target specific Bot Subscriber User IDs instead.', 'boolean', false) }}
```

---

### Bot Subscriber User IDs (Optional)

- Plain text description:
```txt
Use this only when the fixed target is Bot and Broadcast is false. Provide a comma-separated list of subscribed user IDs. Leave blank otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_bot_subscriber_user_ids', 'Use this only when the fixed target is Bot and Broadcast is false. Provide a comma-separated list of subscribed user IDs. Leave blank otherwise.', 'string', '') }}
```

---

### Chat ID (Target = Chat) (Optional)

- Plain text description:
```txt
Provide the exact Zoho Cliq chat ID for this fixed Chat target. Leave blank for every other fixed target. Example chat ID: CT_1234567890_1234567890
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_chat_id', 'Provide the exact Zoho Cliq chat ID for this fixed Chat target. Leave blank for every other fixed target. Example chat ID: CT_1234567890_1234567890', 'string', '') }}
```

---

### Post to Thread (Optional)

- Plain text description:
```txt
Use this only when the fixed target is Chat. Set true to post inside one thread under the fixed Chat ID. Set false to post directly into the chat.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_post_to_thread', 'Use this only when the fixed target is Chat. Set true to post inside one thread under the fixed Chat ID. Set false to post directly into the chat.', 'boolean', false) }}
```

---

### Thread ID (Target = Chat) (Optional)

- Plain text description:
```txt
Use this only when the fixed target is Chat and Post to Thread is true. Provide the exact thread ID under the fixed Chat ID. Leave blank otherwise.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_chat_thread_id', 'Use this only when the fixed target is Chat and Post to Thread is true. Provide the exact thread ID under the fixed Chat ID. Leave blank otherwise.', 'string', '') }}
```

---

### Chat ID (Target = Thread) (Optional)

- Plain text description:
```txt
Provide the exact chat ID that contains the target thread for this fixed Thread target. Use a channel chat_id here when posting into a channel thread. Leave blank for every other fixed target.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_thread_chat_id', 'Provide the exact chat ID that contains the target thread for this fixed Thread target. Use a channel chat_id here when posting into a channel thread. Leave blank for every other fixed target.', 'string', '') }}
```

---

### Thread ID (Target = Thread) (Optional)

- Plain text description:
```txt
Provide the exact thread ID for this fixed Thread target. Leave blank for every other fixed target.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_thread_id', 'Provide the exact thread ID for this fixed Thread target. Leave blank for every other fixed target.', 'string', '') }}
```

---

### Email ID / ZUID (Optional)

- Plain text description:
```txt
Provide one valid Zoho Cliq user email address or ZUID for this fixed User target. This sends a direct message from the authenticated Zoho Cliq user to that recipient. Leave blank for every other fixed target. Example email: jane@example.com. Example ZUID: 839367970
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fixed_target_email_or_zuid', 'Provide one valid Zoho Cliq user email address or ZUID for this fixed User target. This sends a direct message from the authenticated Zoho Cliq user to that recipient. Leave blank for every other fixed target. Example email: jane@example.com. Example ZUID: 839367970', 'string', '') }}
```

---

### Message Type (Optional)

- Plain text description:
```txt
Optional message mode. ENUM: ["text", "json"]. Default `text`. Use `text` for normal plain-text messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_type_fixed_target', 'Optional message mode. ENUM: [\"text\", \"json\"]. Default `text`. Use `text` for normal plain-text messages. Use `json` only when filling the `JSON` field with a raw JSON message object that includes a non-empty top-level `text` string. Use `json` mainly for card payloads.', 'string', 'text') }}
```

---

### Post as Bot (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the fixed target is Channel or Chat and the message should appear from a bot sender identity. Leave false for fixed Bot, Thread, and User targets.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('post_as_bot_fixed_target', 'Optional boolean. Set true only when the fixed target is Channel or Chat and the message should appear from a bot sender identity. Leave false for fixed Bot, Thread, and User targets.', 'boolean', false) }}
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

### Optional Fields > Mark as Read (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the posted message should also be marked as read. This is relevant for fixed Channel, Chat, Thread, and User targets. Fixed Bot-target calls ignore it.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('mark_as_read_fixed_target', 'Optional boolean. Set true only when the posted message should also be marked as read. This is relevant for fixed Channel, Chat, Thread, and User targets. Fixed Bot-target calls ignore it.', 'boolean', false) }}
```

---

### Optional Fields > Reply To Message ID (Optional)

- Plain text description:
```txt
Optional message identifier to reply to inside the fixed target conversation. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message. Leave blank when not replying.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('reply_to_fixed_target', 'Optional message identifier to reply to inside the fixed target conversation. Use the exact `id` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message. Leave blank when not replying.', 'string', '') }}
```

---

### Optional Fields > Sync Message (Optional)

- Plain text description:
```txt
Optional boolean. Set true when the workflow needs returned created-message metadata such as `message_id`. Works for all target families and is recommended whenever the workflow needs `message_id` or other message metadata in the response. Without it, most targets return sparse or empty responses by default.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sync_message_fixed_target', 'Optional boolean. Set true when the workflow needs returned created-message metadata such as `message_id`. Works for all target families and is recommended whenever the workflow needs `message_id` or other message metadata in the response. Without it, most targets return sparse or empty responses by default.', 'boolean', false) }}
```
