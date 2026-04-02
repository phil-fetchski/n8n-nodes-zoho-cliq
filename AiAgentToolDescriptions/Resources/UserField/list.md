# UserField: Retrieve All User Fields

Use this guide to configure **Retrieve All User Fields** for AI Agent Tool mode in n8n.

This operation lists the user-profile field definitions configured in Zoho Cliq.

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
| ON | **Simplified** (default) | Most useful fields per item, nested objects flattened. |
| ON | **Raw** | Full API response as-is — single wrapper with array and pagination keys. |
| ON | **Selected Fields** | Only your chosen **Output Fields**. Record ID always included. |
| OFF | *(hidden)* | Full API response as-is (same as Raw). |

In **Simplified** or **Selected Fields** mode, each record is its own n8n output item (no Split Out needed). If pagination keys exist (`has_more`, `next_token`, `sync_token`), a `_pagination` object is prepended as the first item. In **Raw** mode, the response is a single wrapper object.

Configure Simplify, Simplify Mode, and Output Fields manually rather than delegating to the Agent. Three Tool Descriptions are provided below — **copy the one matching your Simplify mode**. The **Selected Fields** version is a template: edit its example response to list only the fields you configured in Output Fields. `$fromAI()` expressions are also provided if you prefer agent-controlled output.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

Use the Tool Description that matches your configured **Simplify** mode:

### Simplify = Simplified (default)

```txt
List all user-field schema definitions in Zoho Cliq. These records describe profile-field metadata and configuration, not individual user profile values. Successful responses return individual field-definition items. Reuse each item's `id` with Get User Field, Update User Field Details, or Delete User Field. Reuse `unique_name` when later user-profile workflows need the exact custom-field key. Use `type`, `mandatory`, `enabled`, and `system_defined` to decide whether a field can be edited safely. Some `type` values may be system-defined field types such as `employee_id`, `phone_number`, `name_format`, `email_id`, or `time_zone`; those values can appear in list/get responses but are not valid create types for Add User Field. To get dropdown option IDs for later updates, use Get User Field or set Output Fields to include `options`.

Example response:
[
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
    "last_modified_time": "2025-06-01T10:00:00-07:00"
  }
]
```

### Simplify = Selected Fields

```txt
List all user-field schema definitions in Zoho Cliq. These records describe profile-field metadata and configuration, not individual user profile values. Successful responses return individual field-definition items with only the configured Output Fields. `id` is always included. Reuse each item's `id` with Get User Field, Update User Field Details, or Delete User Field. Reuse `unique_name` for later user-profile payloads (include `unique_name` in Output Fields if needed).

Example response:
[
  {
    "id": "1901318000003603019",
    "unique_name": "vaccinated",
    "name": "Vaccinated"
  }
]
```

### Simplify = Raw

```txt
List all user-field schema definitions in Zoho Cliq. These records describe profile-field metadata and configuration, not individual user profile values. Successful responses return `url` and `list`. This tool exposes no pagination inputs and returns the single response body from one `/userfields` request. Reuse `list[].id` with Get User Field, Update User Field Details, or Delete User Field. Reuse `list[].unique_name` when later user-profile workflows need the exact custom-field key. Reuse `list[].type`, `list[].mandatory`, `list[].encrypted`, `list[].edit_permission`, and `list[].options` to decide whether a field can be edited safely. Some returned `list[].type` values may be system-defined field types such as `employee_id`, `phone_number`, `name_format`, `email_id`, or `time_zone`; those values can appear in list/get responses but are not valid create types for Add User Field. For dropdown fields, `list[].options[].id` is available directly from the list response and can be reused in Update User Field Details without a required follow-up get call.

Example response:
{
  "url": "/api/v2/userfields",
  "list": [
    {
      "id": "1901318000003603019",
      "unique_name": "vaccinated",
      "name": "Vaccinated",
      "label": "Vaccinated",
      "type": "drop_down",
      "mandatory": true,
      "encrypted": false,
      "edit_permission": true,
      "enabled": true,
      "system_defined": false,
      "options": [
        {
          "name": "No",
          "id": "1901318000003603023"
        },
        {
          "name": "Yes",
          "id": "1901318000003603021"
        }
      ]
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
