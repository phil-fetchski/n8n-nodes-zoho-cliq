# Thread: Update State

Use this guide to configure **Update State** for AI Tool mode in n8n.

This operation closes or reopens one Zoho Cliq thread, optionally acting as a bot that is already in the parent channel.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.

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
Update one thread state in Zoho Cliq by closing or reopening the thread.

Required inputs:
- `thread_chat_id` such as `CT_1256254372211218512_15067887-T-1256254377053952763`
- `action` with ENUM: ["close", "reopen"]

Optional inputs:
- `bot_unique_name` when the state change should be performed as a bot that is already participating in the parent channel
- `appkey` only when `bot_unique_name` belongs to an extension bot

Input rules:
- use `close` to close the thread
- use `reopen` to reopen a previously closed thread
- `bot_unique_name` must use lowercase letters only (a-z), with no numbers, spaces, or special characters, and must be 30 characters or fewer
- `appkey` is valid only when `bot_unique_name` is also provided

Successful responses return `success`, `resource`, `operation`, `thread_chat_id`, `action`, `thread_state`, and `data`.

Example response:
{
  "success": true,
  "resource": "thread",
  "operation": "updateState",
  "thread_chat_id": "CT_1256254372211218512_15067887-T-1256254377053952763",
  "action": "close",
  "thread_state": "closed",
  "bot_unique_name": "deploybot",
  "appkey": "cliqext_6bfe60b8b9c94a3d8a12",
  "data": ""
}

Chaining guidance:
- reuse `thread_chat_id` for Get Main Message, Get Followers, Post to Thread, or another thread action
- use `thread_state` to decide whether the next action should be `close` or `reopen`
- reuse `action` in logs or downstream approval steps to explain which state transition was requested
- if bot context was used, reuse `bot_unique_name` and `appkey` together on later bot-scoped thread actions
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Thread Chat ID (Required)

- Plain text description:
```txt
Required Zoho Cliq thread chat ID for the thread whose state should be updated. Use the exact thread chat identifier returned by List Threads for Channel or Get Main Message. Example: `CT_1256254372211218512_15067887-T-1256254377053952763`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('thread_chat_id', 'Required Zoho Cliq thread chat ID for the thread whose state should be updated. Use the exact thread chat identifier returned by List Threads for Channel or Get Main Message. Example: CT_1256254372211218512_15067887-T-1256254377053952763.', 'string') }}
```

---

### Action (Required)

- Plain text description:
```txt
Required thread state action. ENUM: ["close", "reopen"]. Use `close` to close the thread. Use `reopen` to reopen a previously closed thread.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action', 'Required thread state action. ENUM: ["close", "reopen"]. Use close to close the thread. Use reopen to reopen a previously closed thread.', 'string') }}
```

---

### Additional Fields > Bot Unique Name (Optional)

- Plain text description:
```txt
Optional bot unique name to perform the thread state change as a bot that is already a participant in the parent channel. Use lowercase letters only (a-z), with no numbers, spaces, or special characters, and keep it to 30 characters or fewer. Leave blank to act as the authenticated user.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_unique_name', 'Optional bot unique name to perform the thread state change as a bot that is already a participant in the parent channel. Use lowercase letters only (a-z), with no numbers, spaces, or special characters, and keep it to 30 characters or fewer. Leave blank to act as the authenticated user.', 'string', '') }}
```

---

### Additional Fields > App Key (Optional)

- Plain text description:
```txt
Optional extension app key for the selected `bot_unique_name`. Only provide this when the bot belongs to an extension app. Leave blank when acting as the authenticated user or when the selected bot does not require an extension app key.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('appkey', 'Optional extension app key for the selected bot_unique_name. Only provide this when the bot belongs to an extension app. Leave blank when acting as the authenticated user or when the selected bot does not require an extension app key.', 'string', '') }}
```
