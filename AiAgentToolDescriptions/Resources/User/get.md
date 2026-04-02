# User: Get User

Use this guide to configure **Get User** for AI Agent Tool mode in n8n.

This operation retrieves one user profile in Zoho Cliq by user ID, email address, or ZUID.

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
Get one user profile in Zoho Cliq using a user identifier. This node accepts a canonical user ID, an email address, or a ZUID in the same `user_id` input. Successful responses return a flat object with the most useful fields. Reuse `id`, `email_id`, or `zuid` with later user, role, team, or profile-management steps. Nested objects like `department` and `designation` are flattened to `department_name` and `designation_name`.

Example response:
{
  "id": "631830849",
  "email_id": "scott.fisher@zylker.com",
  "display_name": "Scott Fisher",
  "first_name": "Scott",
  "last_name": "Fisher",
  "status": "active",
  "timezone": "Asia/Kolkata",
  "country": "IN",
  "department_name": "Zylker Corp",
  "designation_name": "Leadership Staff"
}
```

### Simplify = Selected Fields

```txt
Get one user profile in Zoho Cliq using a user identifier. This node accepts a canonical user ID, an email address, or a ZUID in the same `user_id` input. Successful responses return only the configured Output Fields. `id` is always included. Reuse `id` with later user, role, team, or profile-management steps.

Example response:
{
  "id": "631830849",
  "email_id": "scott.fisher@zylker.com",
  "display_name": "Scott Fisher"
}
```

### Simplify = Raw

```txt
Get one user profile in Zoho Cliq using a user identifier. This node accepts a canonical user ID, an email address, or a ZUID in the same `user_id` input. Successful responses return a `data` object with the user profile. Reuse `data.id`, `data.email_id`, or `data.zuid` with later user, role, team, or profile-management steps. Reuse `data.department.id` or `data.designation.id` for department and designation workflows.

Example response:
{
  "data": {
    "id": "631830849",
    "email_id": "scott.fisher@zylker.com",
    "display_name": "Scott Fisher",
    "first_name": "Scott",
    "last_name": "Fisher",
    "status": "active",
    "timezone": "Asia/Kolkata",
    "department": {
      "id": "1901318000001424001",
      "name": "Zylker Corp"
    },
    "designation": {
      "id": "1901318000001072003",
      "name": "Leadership Staff"
    }
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

### User (Required)

- Plain text description:
```txt
Required user identifier in Zoho Cliq. Pass one exact value: canonical user ID, email address, or ZUID. Example: scott.fisher@zylker.com. Use List Users first when you need to discover a valid identifier.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('user_id', 'Required user identifier in Zoho Cliq. Pass one exact value: canonical user ID, email address, or ZUID. Example: scott.fisher@zylker.com. Use List Users first when you need to discover a valid identifier.', 'string') }}
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
