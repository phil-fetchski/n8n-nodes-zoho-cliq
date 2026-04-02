# UserField: Retrieve User Field

Use this guide to configure **Retrieve User Field** for AI Agent Tool mode in n8n.

This operation retrieves one user-profile field definition in Zoho Cliq by field ID.

- For **User Field** plain-text Sparkles setup, switch the locator from `From List` to `By ID` before delegating the value.
- For **User Field** `$fromAI()` setup, set the field to expression mode before pasting the expression.
## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- The **Simplify** toggle is ON by default, returning simplified output. Turn it OFF for the full raw API response. When ON, use the **Simplify Mode** selector to choose between Simplified, Raw, or Selected Fields — see the **Simplify Output** section below for mode details, Tool Description selection instructions, and guidance on editing the Selected Fields template.

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
Get one user-field schema definition in Zoho Cliq using an exact `field_id`. This operation returns field-definition metadata, not a user's stored field value. Successful responses return a flat object with the most useful fields. Reuse `id` with Update User Field Details or Delete User Field. Reuse `unique_name` as the exact custom-field key for later user-profile create or update payloads. Use `type`, `mandatory`, `enabled`, and `system_defined` to decide what edits are safe.

Example response:
{
  "id": "1901318000001602017",
  "unique_name": "workshift",
  "name": "Work Shift",
  "type": "text_field",
  "label": "Work Shift",
  "mandatory": false,
  "enabled": true,
  "system_defined": false,
  "creation_time": "2025-01-15T09:30:00-07:00",
  "last_modified_time": "2025-01-15T09:30:00-07:00"
}
```

### Simplify = Selected Fields

```txt
Get one user-field schema definition in Zoho Cliq using an exact `field_id`. This operation returns field-definition metadata, not a user's stored field value. Successful responses return only the configured Output Fields. `id` is always included. Reuse `id` with Update User Field Details or Delete User Field. Reuse `unique_name` for later user-profile payloads (include `unique_name` in Output Fields if needed).

Example response:
{
  "id": "1901318000001602017",
  "unique_name": "workshift",
  "name": "Work Shift"
}
```

### Simplify = Raw

```txt
Get one user-field schema definition in Zoho Cliq using an exact `field_id`. This operation returns field-definition metadata, not a user's stored field value. Successful responses return `url` and `data`. Reuse `data.id` with Update User Field Details or Delete User Field. Reuse `data.unique_name` as the exact custom-field key for later user-profile create or update payloads. Reuse `data.type`, `data.mandatory`, `data.encrypted`, `data.edit_permission`, and `data.options` to decide what edits are safe.

Example response:
{
  "url": "/api/v2/userfields/1901318000001602017",
  "data": {
    "id": "1901318000001602017",
    "unique_name": "workshift",
    "name": "Work Shift",
    "label": "Work Shift",
    "type": "text_field",
    "mandatory": false,
    "encrypted": false,
    "edit_permission": false,
    "enabled": true,
    "system_defined": false,
    "default_value": "-"
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

### User Field (Required)

- Plain text description:
```txt
Required exact Zoho Cliq `field_id` for the user-field schema definition to retrieve. Use the field ID returned by Retrieve All User Fields, Retrieve User Field, Add User Field, or Update User Field Details. This is a field-definition identifier, not a user ID.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('field_id', 'Required exact Zoho Cliq `field_id` for the user-field schema definition to retrieve. Use the field ID returned by Retrieve All User Fields, Retrieve User Field, Add User Field, or Update User Field Details. This is a field-definition identifier, not a user ID.', 'string') }}
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
Fields to include in the output when Simplify Mode is set to Selected Fields. The record ID is always included. Available fields: id, unique_name, name, type, label, mandatory, enabled, system_defined, is_searchable, encrypted, edit_permission, creation_time, last_modified_time, organization_id, default_value, options.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: id, unique_name, name, type, label, mandatory, enabled, system_defined, is_searchable, encrypted, edit_permission, creation_time, last_modified_time, organization_id, default_value, options. Return a JSON array of field names (e.g. ["id","unique_name"]) or a comma-separated string (e.g. "id,unique_name"). Both formats are accepted.', 'string', '["id"]') }}
```
