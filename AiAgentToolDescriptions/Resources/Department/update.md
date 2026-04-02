# Department: Update Department

Use this guide to configure **Update Department** for AI Agent Tool mode in n8n.

This operation updates one department in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- The **Simplify** toggle is ON by default, returning simplified output. Turn it OFF for the full raw API response. When ON, use the **Simplify Mode** selector to choose between Simplified, Raw, or Selected Fields — see the **Simplify Output** section below for mode details, Tool Description selection instructions, and guidance on editing the Selected Fields template.
- Set **Input Mode** to `Using JSON`.
- Use `Department Updates (JSON)` for agent-controlled input, not the structured `Prefill Department Name`, `Name`, or `Update Fields` inputs.
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

## Simplify Output

The **Simplify** toggle (ON by default) controls the response shape returned to the Agent. When ON, the **Simplify Mode** selector offers three modes:

| Simplify | Simplify Mode | Behavior |
|---|---|---|
| ON | **Simplified** (default) | Most useful fields only, nested objects flattened. |
| ON | **Raw** | Full API response as-is, including wrapper object. |
| ON | **Selected Fields** | Only your chosen **Output Fields**. Record ID always included. |
| OFF | *(hidden)* | Full API response as-is (same as Raw). |

Configure Simplify, Simplify Mode, and Output Fields manually rather than delegating to the Agent. Three Tool Descriptions are provided below — **copy the one matching your Simplify mode**. The **Selected Fields** version is a template: edit its example response to list only the fields you configured in Output Fields. `$fromAI()` expressions are also provided if you prefer agent-controlled output.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

Use the Tool Description that matches your configured **Simplify** mode:

### Simplify = Simplified (default)

```txt
Update one department in Zoho Cliq using department_id plus a raw JSON update object. The update object may include name, lead_zuid, parent_department_id, and user_ids fields. Omit name when it is not changing. Successful responses return a flat object with the most useful fields. Reuse id and parent_department_id for later department workflows.

For example:
{
  "id": "1901318000002280001",
  "name": "Platform Engineering",
  "parent_department_id": "1901318000001424001",
  "is_default": false,
  "members_count": "3",
  "lead_id": "631830849",
  "lead_name": "Scott Fisher",
  "lead_email": "scott.fisher@zylker.com"
}
```

### Simplify = Selected Fields

```txt
Update one department in Zoho Cliq using department_id plus a raw JSON update object. The update object may include name, lead_zuid, parent_department_id, and user_ids fields. Omit name when it is not changing. Successful responses return only the configured Output Fields. id is always included. Reuse id for later department workflows.

For example:
{
  "id": "1901318000002280001",
  "name": "Platform Engineering",
  "parent_department_id": "1901318000001424001"
}
```

### Simplify = Raw

```txt
Update one department in Zoho Cliq using department_id plus a raw JSON update object. The update object may include name, lead_zuid, parent_department_id, and user_ids fields. Omit name when it is not changing. Successful responses return the updated department payload. Reuse data.id, data.parent_department_id, and data.lead_zuid for later department workflows.

For example:
{
  "data": {
    "id": "1901318000002280001",
    "name": "Platform Engineering",
    "parent_department_id": "1901318000001424001",
    "lead_zuid": "631830849",
    "is_default": false
  }
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Department (Required)

- Plain text description:
```txt
Required department_id in Zoho Cliq to update. Use the exact department ID string, not a department name. Example: 1901318000001071015.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('department_id', 'Required department ID in Zoho Cliq to update. Use the exact department ID string, not a department name. Example: 1901318000001071015.', 'string') }}
```

---

### Department Updates (JSON) (Required When Input Mode = Using JSON)

- Plain text description:
```txt
Required non-empty top-level JSON object for a Zoho Cliq department update. Allowed top-level keys are exactly name, lead_zuid, parent_department_id, and user_ids. name is optional when it is not being changed, but when provided it must be a non-empty string. lead_zuid and parent_department_id are optional string fields. user_ids is optional, but when included it must be an array of one or more Zoho Cliq user ID strings. Do not send user_ids as a comma-separated string in Using JSON mode. Omit optional fields entirely when they are not being changed. Do not send any other keys. Use one of these payload shapes:
{
  "lead_zuid": "631830849"
}
or
{
  "name": "Platform Engineering",
  "lead_zuid": "631830849",
  "parent_department_id": "1901318000001424001",
  "user_ids": [
    "636000786"
  ]
}
Unsafe keys such as __proto__, constructor, and prototype are rejected.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('department_updates', 'Required non-empty top-level JSON object for a Zoho Cliq department update. Allowed top-level keys are exactly name, lead_zuid, parent_department_id, and user_ids. name is optional when it is not being changed, but when provided it must be a non-empty string. lead_zuid and parent_department_id are optional string fields. user_ids is optional, but when included it must be an array of one or more Zoho Cliq user ID strings. Do not send user_ids as a comma-separated string in Using JSON mode. Omit optional fields entirely when they are not being changed. Do not send any other keys. Use one of these payload shapes: {"lead_zuid":"631830849"} or {"name":"Platform Engineering","lead_zuid":"631830849","parent_department_id":"1901318000001424001","user_ids":["636000786"]}. Unsafe keys such as __proto__, constructor, and prototype are rejected.', 'string') }}
```

---

### Simplify (Optional — recommended to set manually)

- Plain text description:
```txt
Whether to return a simplified version of the response instead of the raw data. When enabled (default), the Simplify Mode selector controls the output shape. When disabled, the full raw API response is returned.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplify', 'Whether to simplify the response. Set to true (default) for simplified output or false for the full raw API response.', 'boolean', 'true') }}
```

---

### Simplify Mode (Optional — shown when Simplify = enabled, recommended to set manually)

- Plain text description:
```txt
How to simplify the response output. Use 'simplified' for the most useful fields only (default), 'raw' for the complete API response, or 'selectedFields' to choose specific fields via Output Fields. ENUM: ["simplified", "raw", "selectedFields"].
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyMode', "How to simplify the response output. Use 'simplified' for the most useful fields only (default), 'raw' for the complete API response, or 'selectedFields' to choose specific fields via Output Fields. ENUM: [\"simplified\", \"raw\", \"selectedFields\"].", 'string', 'simplified') }}
```

---

### Output Fields (Optional — shown when Simplify Mode = Selected Fields)

- Plain text description:
```txt
Fields to include in the output when Simplify Mode is set to Selected Fields. The record ID is always included. Available fields: id, name, parent_department_id, lead_zuid, is_default, members_count, lead.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: id, name, parent_department_id, lead_zuid, is_default, members_count, lead. Return a JSON array of field names (e.g. ["id","name"]) or a comma-separated string (e.g. "id,name"). Both formats are accepted.', 'string', '["id"]') }}
```
