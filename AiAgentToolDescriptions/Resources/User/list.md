# User: List Users

Use this guide to configure **List Users** for AI Agent Tool mode in n8n.

This operation lists users in Zoho Cliq with optional search, pagination, status, plan, sorting, and modified-time filters.

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
List users in Zoho Cliq using optional `search`, `limit`, `next_token`, `status`, `plan_type`, `sort_by`, and `modified_after` filters. `modified_after` accepts an ISO 8601 date-time string or a Unix-millisecond timestamp string. Successful responses return individual user items. When pagination metadata exists, the first item is a `_pagination` object containing `has_more` and `next_token`. Reuse each user's `id`, `email_id`, or `zuid` with Get User or Get User Teams, and reuse `next_token` from `_pagination` exactly as returned to fetch the next page. In returned user items, `zoid` is the broader Zoho platform organization ID, while `organization_id` is the Zoho Cliq organization ID. Do not assume those two fields always match.

Example response:
[
  { "_pagination": { "has_more": true, "next_token": "REDACTED_NEXT_TOKEN" } },
  {
    "id": "163315760",
    "email_id": "yoda@zylker.com",
    "display_name": "Yod",
    "first_name": "Yod",
    "last_name": "Agbaria",
    "status": "active",
    "timezone": "Asia/Kolkata",
    "country": "IN",
    "department_name": "Zylker Corp",
    "designation_name": "Leadership Staff"
  }
]
```

### Simplify = Selected Fields

```txt
List users in Zoho Cliq using optional `search`, `limit`, `next_token`, `status`, `plan_type`, `sort_by`, and `modified_after` filters. `modified_after` accepts an ISO 8601 date-time string or a Unix-millisecond timestamp string. Successful responses return individual user items with only the configured Output Fields. id is always included. When pagination metadata exists, the first item is a `_pagination` object containing `has_more` and `next_token`. Reuse each user's `id` with Get User or Get User Teams, and reuse `next_token` from `_pagination` exactly as returned to fetch the next page.

Example response:
[
  { "_pagination": { "has_more": true, "next_token": "REDACTED_NEXT_TOKEN" } },
  {
    "id": "163315760",
    "email_id": "yoda@zylker.com",
    "display_name": "Yod"
  }
]
```

### Simplify = Raw

```txt
List users in Zoho Cliq using optional `search`, `limit`, `next_token`, `status`, `plan_type`, `sort_by`, and `modified_after` filters. `modified_after` accepts an ISO 8601 date-time string or a Unix-millisecond timestamp string. Successful responses return a `data` array of user summaries and may include `next_token` plus `has_more` for pagination. Reuse `data[].id`, `data[].email_id`, or `data[].zuid` with Get User or Get User Teams, and reuse `next_token` exactly as returned to fetch the next page. In returned user summaries, `zoid` is the broader Zoho platform organization ID, while `organization_id` is the Zoho Cliq organization ID. Do not assume those two fields always match.

Example response:
{
  "data": [
    {
      "id": "163315760",
      "email_id": "yoda@zylker.com",
      "zuid": "163315760",
      "zoid": "54107592",
      "display_name": "Yod",
      "name": "Yod Agbaria",
      "organization_id": "631836344"
    }
  ],
  "next_token": "REDACTED_NEXT_TOKEN",
  "has_more": true
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Search (Optional)

- Plain text description:
```txt
Optional user search string. Searches name or email in standard Cliq results. If Zoho People scopes are also granted, search may match additional People fields. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('search', 'Optional user search string. Searches name or email in standard Cliq results. If Zoho People scopes are also granted, search may match additional People fields. Blank values are allowed and omitted.', 'string', '') }}
```

---

### Additional Fields > Limit (Optional)

- Plain text description:
```txt
Optional whole-number page size. Valid range is 1 to 100.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('limit', 'Optional whole-number page size (limit). Use a whole number from 1 to 100.', 'number', 50) }}
```

---

### Additional Fields > Modified After (Optional)

- Plain text description:
```txt
Optional incremental-sync filter. Use an ISO 8601 date-time string such as 2025-06-01T10:00:00Z or a Unix-millisecond timestamp string. Blank values are allowed and omitted. Zoho documents only the last 7 days of changes, and this filter only tracks changes to department, designation, employee ID, extension, reporting-to, and work-location fields.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('modified_after', 'Optional incremental-sync filter. Use an ISO 8601 date-time string such as 2025-06-01T10:00:00Z or a Unix-millisecond timestamp string. Blank values are allowed and omitted. Zoho documents only the last 7 days of changes, and this filter only tracks changes to department, designation, employee ID, extension, reporting-to, and work-location fields.', 'string', '') }}
```

---

### Additional Fields > Next Token (Optional)

- Plain text description:
```txt
Optional pagination cursor returned by a previous List Users response as next_token. Reuse exactly as returned to fetch the next page. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_token', 'Optional pagination cursor returned by a previous List Users response as next_token. Reuse exactly as returned to fetch the next page. Blank values are allowed and omitted.', 'string', '') }}
```

---

### Additional Fields > Plan Type (Optional)

- Plain text description:
```txt
Optional subscription filter. Allowed values: ["paid", "free"]. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('plan_type', 'Optional subscription filter. Allowed values: ["paid", "free"]. Blank values are allowed and omitted.', 'string', '') }}
```

---

### Additional Fields > Sort By (Optional)

- Plain text description:
```txt
Optional list ordering field. Allowed values: ["usage"]. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('sort_by', 'Optional list ordering field. Allowed values: ["usage"]. Blank values are allowed and omitted.', 'string', '') }}
```

---

### Additional Fields > Status (Optional)

- Plain text description:
```txt
Optional user-status filter. Allowed values: ["active", "inactive", "pending", "imported_active", "imported_inactive"]. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('status', 'Optional user-status filter. Allowed values: ["active", "inactive", "pending", "imported_active", "imported_inactive"]. Blank values are allowed and omitted.', 'string', '') }}
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
Fields to include in the output when Simplify Mode is set to Selected Fields. The record ID is always included. Available fields: id, email_id, display_name, first_name, last_name, full_name, name, nick_name, employee_id, status, user_org_status, department, designation, reportingto, profile, timezone, country, language, language_variant, mobile, phone, extension, work_location, user_type, zoid, organization_id, zuid, iamuid, timeoffset, invited_time, custom_attributes.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: id, email_id, display_name, first_name, last_name, full_name, name, nick_name, employee_id, status, user_org_status, department, designation, reportingto, profile, timezone, country, language, language_variant, mobile, phone, extension, work_location, user_type, zoid, organization_id, zuid, iamuid, timeoffset, invited_time, custom_attributes. Return a JSON array of field names (e.g. ["id","email_id"]) or a comma-separated string (e.g. "id,email_id"). Both formats are accepted.', 'string', '["id"]') }}
```
