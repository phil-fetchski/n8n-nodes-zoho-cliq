# Reminders: Create Reminder

Use this guide to configure **Create Reminder** for AI Agent Tool mode in n8n.

This operation creates one reminder in Zoho Cliq using the dedicated AI-friendly agent/tool field mode.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Set **Input Mode** to `Agent/Tool Setup Fields`.
- Do not delegate **Input Mode** to the agent.

This mode renders the create-type-specific reminder inputs at the same time so the agent can fill the right subset for the chosen reminder story without depending on hidden fields.

## Important Disclaimer

### Every Input Has an Example — Use Only What You Need

This guide provides a description and `$fromAI()` expression for **every** input so you have a ready-made starting point for each one. This is **not** a recommendation to enable them all on any given tool. Every workflow is different — give your agent control over only the inputs it genuinely needs to decide.

- **Hardcode what doesn't change.** If a value is the same every run (e.g., always posting to the same channel), hardcode it or use a standard n8n expression. There is no reason for the agent to provide what it doesn't need to decide.
- **Every token costs money.** Each `$fromAI()` field adds tokens to every agent invocation. More fields mean higher cost per run — configure deliberately.
- **Security surface.** Each agent-controlled field is a runtime decision you are delegating to a model. The more you delegate, the larger the blast radius if intent is misinterpreted. Grant only the minimum access your workflow requires.

### Liability Notice

By configuring AI agent access to your Zoho Cliq account, **you accept full responsibility** for any changes the agent makes — including messages sent, channels created or deleted, users modified or removed, and any other account changes. The node developer accepts **zero liability** for any outcome resulting from agent actions on your account.

Test in a non-production environment first and **use a capable frontier model from a major lab**.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Create one reminder in Zoho Cliq. Use `create_type` to choose the reminder story: `self` creates a reminder for the authenticated user, `users` creates a reminder for one or more users, `chat` creates a reminder for one chat, and `message` turns an existing message in a chat into a reminder. In Agent/Tool Setup Fields mode, all reminder inputs can be visible together, but only the inputs required by the chosen `create_type` are mandatory: `users` requires `content`, `time`, and `user_ids`; `chat` requires `content`, `time`, and one `chat_id`; `message` requires `time`, `chat_id`, and `message_id`, while `content` and `user_ids` are optional. Use chat IDs only for `chat_id` in both the `chat` and `message` variants. Do not pass a channel ID here. `content` is required for `create_type` values `self`, `users`, and `chat`, but can be blank for `message`. `time` is optional only for `self`; for `users`, `chat`, and `message`, provide an ISO 8601 datetime string or Unix/epoch millisecond value. When `create_type="self"` is created without a trigger time, Zoho Cliq returns `time: -1` in the response to mean no trigger time was set. `message_id` accepts either a long numeric value or the `timestamp_uniqueId` format, for example `1772395354414_196142356543`. For `create_type="message"`, get `chat_id` and `message_id` from `Get Messages`, `Retrieve Message`, or a `Post Message` response that returned `message_id`. Leave non-applicable optional fields blank. Zoho Cliq reminder categories are bucket labels: use `mine` for the authenticated user's active reminders, `mine-completed` for their completed reminders, `others` for active reminders they created for other users or chats/channels, and `others-completed` for those created-for-others reminders after completion. For follow-up steps, `self` reminders typically land in `mine`, while reminders created for users or chats typically land in `others`. For `create_type="message"`, the reminder inherits the creator/owner context of that message flow, so it typically maps to `others` unless the message is in the creator's personal chat, in which case it maps to `mine`. Successful responses return the created reminder object, typically including `id`, `content`, `completed`, `time`, `creation_time`, `creator`, and any `users` or `chats` attached to that reminder. Reuse `id` for later `get`, `update`, `delete`, `snooze`, or assignee actions. Good chaining pattern: create -> get to confirm the final stored payload -> list the expected category if you need to reason about reminder ownership/state.

Example response:
{
  "id": "11360000000204007",
  "content": "Content Review for ZylCal",
  "completed": false,
  "creation_time": 1506398400000,
  "time": 1506571200000,
  "users": [
    {
      "id": "1234567",
      "name": "Scott Fisher",
      "completed": false
    }
  ]
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Create Type (Required)

- Plain text description:
```txt
Required reminder variant selector. ENUM: ["self", "users", "chat", "message"]. Use `self` for a reminder for the authenticated user. Use `users` to create a reminder for one or more users. Use `chat` to create a reminder for one chat only. Do not use a channel ID for the `chat` or `message` variants. Use `message` to turn an existing message in a chat into a reminder. For later list reasoning, `self` reminders usually show up in `mine`, `users` and `chat` reminders usually show up in `others`, and `message` reminders inherit the creator/owner context so they usually show up in `others` unless the source message is in the creator's personal chat, in which case they map to `mine`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('create_type', 'Required reminder variant selector. ENUM: ["self", "users", "chat", "message"]. Use `self` for a reminder for the authenticated user. Use `users` to create a reminder for one or more users. Use `chat` to create a reminder for one chat only. Do not use a channel ID for the `chat` or `message` variants. Use `message` to turn an existing message in a chat into a reminder. For later list reasoning, `self` reminders usually show up in `mine`, `users` and `chat` reminders usually show up in `others`, and `message` reminders inherit the creator/owner context so they usually show up in `others` unless the source message is in the creator\'s personal chat, in which case they map to `mine`.', 'string') }}
```

---

### Content (Optional)

- Plain text description:
```txt
Optional reminder text content. Required for `create_type` values `self`, `users`, and `chat`. Optional for `create_type` value `message` because the source message can act as the reminder content. Leave blank to omit when `create_type` is `message`. Maximum length: 512 characters.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('content', 'Optional reminder text content. Required for `create_type` values `self`, `users`, and `chat`. Optional for `create_type` value `message` because the source message can act as the reminder content. Leave blank to omit when `create_type` is `message`. Maximum length: 512 characters.', 'string', '') }}
```

---

### Time (Optional)

- Plain text description:
```txt
Reminder trigger time. Required for `create_type` values `users`, `chat`, and `message`. Optional only for `create_type="self"`. Use a strict ISO 8601 datetime string such as `2026-03-02T09:30:00Z` or an ISO 8601 datetime with timezone offset such as `2026-03-19T09:30:00-04:00`. If you are reusing an existing reminder time value returned by Zoho Cliq, the Unix/epoch millisecond value from that response is also accepted. For self reminders created without a trigger time, Zoho Cliq returns `time: -1` in the response to mean no trigger time was set.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('time', 'Reminder trigger time. Required for `create_type` values `users`, `chat`, and `message`. Optional only for `create_type=\"self\"`. Use a strict ISO 8601 datetime string such as `2026-03-02T09:30:00Z` or an ISO 8601 datetime with timezone offset such as `2026-03-19T09:30:00-04:00`. If you are reusing an existing reminder time value returned by Zoho Cliq, the Unix/epoch millisecond value from that response is also accepted. For self reminders created without a trigger time, Zoho Cliq returns `time: -1` in the response to mean no trigger time was set.', 'string', '') }}
```

---

### User IDs (Optional)

- Plain text description:
```txt
Optional comma-separated user IDs. Required for `create_type="users"`. Optional for `create_type="message"`. Leave blank for `self` or `chat`. Maximum 4 users. Example: `723419201,249871345`
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('user_ids', 'Optional comma-separated user IDs. Required for `create_type=\"users\"`. Optional for `create_type=\"message\"`. Leave blank for `self` or `chat`. Maximum 4 users. Example: `723419201,249871345`', 'string', '') }}
```

---

### Chat ID (Optional)

- Plain text description:
```txt
Single exact Zoho Cliq `chat_id`. Required for `create_type` values `chat` and `message`. Use chat IDs only, not channel IDs, for both variants. Provide exactly one chat ID as a string, not multiple IDs. For `create_type="chat"`, this is the target chat for the reminder. For `create_type="message"`, this is the chat that contains the source message. Example shapes: `CT_2230748078536646675_631836344` or `1277744356562927809`
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('chat_id', 'Single exact Zoho Cliq `chat_id`. Required for `create_type` values `chat` and `message`. Use chat IDs only, not channel IDs, for both variants. Provide exactly one chat ID as a string, not multiple IDs. For `create_type=\"chat\"`, this is the target chat for the reminder. For `create_type=\"message\"`, this is the chat that contains the source message. Example shapes: `CT_2230748078536646675_631836344` or `1277744356562927809`', 'string', '') }}
```

---

### Message ID (Optional)

- Plain text description:
```txt
Optional exact message ID to turn into a reminder. Required only for `create_type` value `message`. Leave blank for `self`, `users`, or `chat`. Use the exact `id` returned by `Get Messages` or `Retrieve Message`, or the exact `message_id` returned by `Post Message`. The value can be a long numeric message ID or the `timestamp_uniqueId` form returned by Zoho Cliq, for example `1772395354414_196142356543`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('message_id', 'Optional exact message ID to turn into a reminder. Required only for `create_type` value `message`. Leave blank for `self`, `users`, or `chat`. Use the exact `id` returned by `Get Messages` or `Retrieve Message`, or the exact `message_id` returned by `Post Message`. The value can be a long numeric message ID or the `timestamp_uniqueId` form returned by Zoho Cliq, for example `1772395354414_196142356543`.', 'string', '') }}
```
