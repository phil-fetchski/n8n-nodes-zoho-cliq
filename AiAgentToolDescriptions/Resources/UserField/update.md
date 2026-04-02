# UserField: Update User Field Details

Use this guide to configure **Update User Field Details** for AI Agent Tool mode in n8n.

This operation updates one user-profile field definition in Zoho Cliq.

Note: some older references spell the update scope as `ZohoCliq.Userfields.UPDATE`, but this node enforces `ZohoCliq.UserFields.UPDATE`.

- For **User Field** plain-text Sparkles setup, switch the locator from `From List` to `By ID` before delegating the value.
- For **User Field** `$fromAI()` setup, set the field to expression mode before pasting the expression.
- Set **Input Mode** to `Agent/Tool Setup Fields`.
## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- The **Simplify** toggle is ON by default, returning simplified output. Turn it OFF for the full raw API response. When ON, use the **Simplify Mode** selector to choose between Simplified, Raw, or Selected Fields — see the **Simplify Output** section below for mode details, Tool Description selection instructions, and guidance on editing the Selected Fields template.
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
Update one user-field schema definition in Zoho Cliq using an exact `field_id`. This tool updates field-definition metadata, not stored user values. Optional inputs are `name`, `mandatory`, `encrypted`, `edit_permission`, `replace_dropdown_options`, and `dropdown_options_json`. When `replace_dropdown_options=true`, `dropdown_options_json` becomes the option payload and must be a JSON array of objects with required `name` plus optional existing `id`. This is different from Add User Field: create accepts plain comma-separated option labels, but update expects option objects. Do not send `type`; this update operation rejects it. At least one update field besides `field_id` is required; `field_id` by itself returns a validation error rather than a no-op. `name` must be 30 characters or fewer when provided. Each option `id`, when present, must be unique and should come from a previous dropdown field response. `edit_permission=true` means end users can edit their own profile value for this field; it does not grant permission to change the field-definition schema itself. `encrypted=true` marks the schema as encrypted for sensitive values. Once a user field is encrypted, it cannot be changed back to unencrypted.

Successful responses return a flat object with the most useful fields. Reuse `id` for later get, update, or delete calls. Reuse `unique_name` as the exact custom-field key in later user-profile payloads. To get dropdown option IDs after changes, use Get User Field or set Output Fields to include `options`.

Example response:
{
  "id": "1901318000003603019",
  "unique_name": "vaccinated",
  "name": "Vaccinated",
  "type": "drop_down",
  "label": "Vaccinated",
  "mandatory": true,
  "enabled": true,
  "system_defined": false,
  "creation_time": "2025-06-01T10:00:00-07:00",
  "last_modified_time": "2025-06-15T14:30:00-07:00"
}
```

### Simplify = Selected Fields

```txt
Update one user-field schema definition in Zoho Cliq using an exact `field_id`. This tool updates field-definition metadata, not stored user values. Optional inputs are `name`, `mandatory`, `encrypted`, `edit_permission`, `replace_dropdown_options`, and `dropdown_options_json`. When `replace_dropdown_options=true`, `dropdown_options_json` becomes the option payload and must be a JSON array of objects with required `name` plus optional existing `id`. This is different from Add User Field: create accepts plain comma-separated option labels, but update expects option objects. Do not send `type`; this update operation rejects it. At least one update field besides `field_id` is required; `field_id` by itself returns a validation error rather than a no-op. `name` must be 30 characters or fewer when provided. Each option `id`, when present, must be unique and should come from a previous dropdown field response. `edit_permission=true` means end users can edit their own profile value for this field; it does not grant permission to change the field-definition schema itself. `encrypted=true` marks the schema as encrypted for sensitive values. Once a user field is encrypted, it cannot be changed back to unencrypted.

Successful responses return only the configured Output Fields. `id` is always included. Reuse `id` for later get, update, or delete calls. Reuse `unique_name` for later user-profile payloads (include `unique_name` in Output Fields if needed).

Example response:
{
  "id": "1901318000003603019",
  "unique_name": "vaccinated",
  "name": "Vaccinated"
}
```

### Simplify = Raw

```txt
Update one user-field schema definition in Zoho Cliq using an exact `field_id`. This tool updates field-definition metadata, not stored user values. Optional inputs are `name`, `mandatory`, `encrypted`, `edit_permission`, `replace_dropdown_options`, and `dropdown_options_json`. When `replace_dropdown_options=true`, `dropdown_options_json` becomes the option payload and must be a JSON array of objects with required `name` plus optional existing `id`. This is different from Add User Field: create accepts plain comma-separated option labels, but update expects option objects. Do not send `type`; this update operation rejects it. At least one update field besides `field_id` is required; `field_id` by itself returns a validation error rather than a no-op. `name` must be 30 characters or fewer when provided. Each option `id`, when present, must be unique and should come from a previous dropdown field response. `edit_permission=true` means end users can edit their own profile value for this field; it does not grant permission to change the field-definition schema itself. `encrypted=true` marks the schema as encrypted for sensitive values. Once a user field is encrypted, it cannot be changed back to unencrypted.

Successful responses return `url` and `data`. Reuse `data.id` for later get, update, or delete calls. Reuse `data.unique_name` as the exact custom-field key in later user-profile payloads. Reuse `data.options[].id` after dropdown-option changes because option IDs are the stable identifiers for future edits.

Example response:
{
  "url": "/api/v2/userfields/1901318000003603019",
  "data": {
    "id": "1901318000003603019",
    "unique_name": "vaccinated",
    "name": "Vaccinated",
    "label": "Vaccinated",
    "type": "drop_down",
    "mandatory": true,
    "encrypted": false,
    "edit_permission": false,
    "default_value": "No",
    "options": [
      {
        "name": "No I am yet to get vaccinated",
        "id": "1901318000003603023"
      },
      {
        "name": "Yes I have been vaccinated",
        "id": "1901318000003603021"
      }
    ]
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
Required exact Zoho Cliq `field_id` for the user-field schema definition to update. Use the field ID returned by Retrieve All User Fields or Retrieve User Field. This is a field-definition identifier, not a user ID.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('field_id', 'Required exact Zoho Cliq `field_id` for the user-field schema definition to update. Use the field ID returned by Retrieve All User Fields or Retrieve User Field. This is a field-definition identifier, not a user ID.', 'string') }}
```

---

### Name (Optional)

- Plain text description:
```txt
Optional new display name for the user-field schema definition. Blank values are allowed and treated as omitted. Max 30 characters.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('name', 'Optional new display name for the user-field schema definition. Blank values are allowed and treated as omitted. Max 30 characters.', 'string', '') }}
```

---

### Mandatory (Optional)

- Plain text description:
```txt
Optional requirement flag for this user-field schema. ENUM: ["unset", "true", "false"]. Use `unset` to omit the setting and leave this rule unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('mandatory', 'Optional requirement flag for this user-field schema. ENUM: ["unset", "true", "false"]. Use "unset" to omit the setting and leave this rule unchanged.', 'string', 'unset') }}
```

---

### Encrypted (Optional)

- Plain text description:
```txt
Optional encryption flag for this user-field schema. ENUM: ["unset", "true", "false"]. Use `true` for sensitive profile fields. Once a user field is encrypted, it cannot be changed back to unencrypted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('encrypted', 'Optional encryption flag for this user-field schema. ENUM: ["unset", "true", "false"]. Use "true" for sensitive profile fields. Once a user field is encrypted, it cannot be changed back to unencrypted.', 'string', 'unset') }}
```

---

### Edit Permission (Optional)

- Plain text description:
```txt
Optional end-user edit flag. ENUM: ["unset", "true", "false"]. `true` means end users can edit their own profile value for this field. It does not grant permission to change the field-definition schema itself.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('edit_permission', 'Optional end-user edit flag. ENUM: ["unset", "true", "false"]. "true" means end users can edit their own profile value for this field. It does not grant permission to change the field-definition schema itself.', 'string', 'unset') }}
```

---

### Replace Dropdown Options (Optional)

- Plain text description:
```txt
Optional boolean. Set `true` only when this update should send `dropdown_options_json` as the option payload. If `false`, the existing option set is left unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('replace_dropdown_options', 'Optional boolean. Set true only when this update should send dropdown_options_json as the option payload. If false, the existing option set is left unchanged.', 'boolean', false) }}
```

---

### Dropdown Options (JSON) (Optional When Replace Dropdown Options = True)

- Plain text description:
```txt
JSON array of dropdown option objects for this update. Use only when `replace_dropdown_options=true`. Each array entry must be an object with required `name` and optional existing `id`. Example: [{"id":"1901318000003603021","name":"Yes I have been vaccinated"},{"name":"Prefer not to say"}]. Update uses option objects, not plain strings like Add User Field. Do not send an empty array here; the node rejects empty option arrays when `replace_dropdown_options=true`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('dropdown_options_json', 'JSON array of dropdown option objects for this update. Use only when replace_dropdown_options is true. Each array entry must be an object with required name and optional existing id. Example: [{"id":"1901318000003603021","name":"Yes I have been vaccinated"},{"name":"Prefer not to say"}]. Update uses option objects, not plain strings like Add User Field. Do not send an empty array here; the node rejects empty option arrays when replace_dropdown_options is true.', 'string', '[]') }}
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
