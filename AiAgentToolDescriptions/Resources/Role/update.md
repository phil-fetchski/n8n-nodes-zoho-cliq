# Role: Update Role

Use this guide to configure **Update Role** for AI Agent Tool mode in n8n.

This operation updates one role in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Set **Input Mode** to `Using Fields Below`.
- Do not delegate **Input Mode** to the agent.

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
Update one role in Zoho Cliq using a canonical role ID and structured fields. Use this when the role already exists and you want to change its name and/or description. Provide at least one update field. If Prefill Existing Role Name is true and Name is left blank while Description is provided, the node tries to reuse the current role name automatically before sending the update. Successful responses return the raw Zoho Cliq update response, which can be sparse for this endpoint. Reuse the same role ID with Get Role when you need the refreshed full role object after the update.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Role (Required)

- Plain text description:
```txt
Required canonical role ID in Zoho Cliq. Use the exact role ID you want to update, for example 42405000000224001.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('role_id', 'Required canonical role ID in Zoho Cliq. Use the exact role ID you want to update, for example 42405000000224001.', 'string') }}
```

---

### Prefill Existing Role Name (Optional)

- Plain text description:
```txt
Optional boolean in Zoho Cliq. Use true when Name is blank and you still want the node to try to fetch and reuse the current role name before sending a Description update. Use false when you want the request to use only the fields you supplied. Default is true.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('prefill_role_name', 'Optional boolean in Zoho Cliq. Use true when Name is blank and you still want the node to try to fetch and reuse the current role name before sending a Description update. Use false when you want the request to use only the fields you supplied. Default is true.', 'boolean', true) }}
```

---

### Name (Optional)

- Plain text description:
```txt
Optional new role name in Zoho Cliq. Leave blank to keep the current name unchanged. When provided, the name must be non-empty and 120 characters or fewer. Provide at least one of Name or Description for the update to be valid.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('role_name', 'Optional new role name in Zoho Cliq. Leave blank to keep the current name unchanged. When provided, the name must be non-empty and 120 characters or fewer. Provide at least one of Name or Description for the update to be valid.', 'string', '') }}
```

---

### Description (Optional)

- Plain text description:
```txt
Optional new role description in Zoho Cliq. Leave blank to omit it from the update. Maximum length is 1000 characters. Provide at least one of Name or Description for the update to be valid.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('role_description', 'Optional new role description in Zoho Cliq. Leave blank to omit it from the update. Maximum length is 1000 characters. Provide at least one of Name or Description for the update to be valid.', 'string', '') }}
```
