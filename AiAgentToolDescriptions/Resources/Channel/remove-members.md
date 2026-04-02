# Channel: Remove Channel Members

Use this guide to configure **Remove Channel Members** for AI Agent Tool mode in n8n.

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
Remove users from a channel in Zoho Cliq using one comma-separated member identifier input (email IDs or user IDs only, not mixed).
Keep **Include Enhanced Output** enabled to return workflow-ready success context.
This convenience operation loops through identifiers and calls Remove Channel Member once per identifier.

Example enhanced response shape:
{
  "success": true,
  "operation": "remove_channel_members",
  "channel_id": "P1234567890123456789",
  "identifier_type": "user_ids",
  "removed_identifiers": ["1234567", "7654321"],
  "count": 2,
  "api_call_count": 2,
  "delete_member_endpoint_used": true
}
```

## Endpoint Mapping Note

```txt
This is a convenience operation in the node.
It loops through all provided identifiers and calls:
DELETE /channels/{CHANNEL_ID}/members/{MEMBER_IDENTIFIER}
One API call is made per identifier.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Channel (Required)

- Plain text description:
```txt
Required channel_id in Zoho Cliq where members will be removed. In AI Tool mode, pass only the canonical channel ID string (for example, P1234567890123456789). Do not pass channel unique name.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_id', 'Required channel ID in Zoho Cliq where members should be removed. Pass only the canonical channel ID string (for example, P1234567890123456789). Do not pass channel unique name here, channel ID ONLY.', 'string') }}
```

---

### Member Identifiers (Required)

- Plain text description:
```txt
Required comma-separated member identifiers. Provide either all email IDs or all user IDs in one request. Mixed types are rejected.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('member_identifiers', 'Required comma-separated member identifiers. Use either all email IDs or all user IDs in one request. Mixed types are not supported.', 'string') }}
```

---

### Scale Note

```txt
There is no hard identifier cap in this operation, but each identifier triggers a separate API call.
For large removals, account for API call volume, rate limits, and runtime duration.
```
