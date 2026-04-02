# User: Update User

Use this guide to configure **Update User** for AI Agent Tool mode in n8n.

This operation updates one existing user in Zoho Cliq using the dedicated AI-friendly flattened field mode.

- Set **Input Mode** to `Agent/Tool Setup Fields`.
## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- The **Simplify** toggle is ON by default, returning simplified output. Turn it OFF for the full raw API response. When ON, use the **Simplify Mode** selector to choose between Simplified, Raw, or Selected Fields — see the **Simplify Output** section below for mode details, Tool Description selection instructions, and guidance on editing the Selected Fields template.
- Do not delegate **Input Mode** to the agent.

This mode renders the Update User inputs together in one flattened form so the agent can update normal user fields directly instead of constructing a raw JSON object.

## Alternative Setup Option: Using JSON (Advanced)

If you prefer one agent-controlled JSON object, you can instead set **Input Mode** to `Using JSON` and use **User Payload (JSON)**.

That Using JSON option is not the recommended AI Tool setup for this operation.

- Use **Agent/Tool Setup Fields** when you want the best AI-facing setup contract for one-user updates.
- The Using JSON option is better only when the agent truly needs to build the entire update object itself.
- Using JSON still supports **AI Error Mode** and JSON/body validation, but it does not get the same flattened field guidance as the recommended **Agent/Tool Setup Fields** mode.
- Choose one setup style only. Do not mix the flattened agent fields with **User Payload (JSON)** in the same tool.

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
Update one existing user in Zoho Cliq. Use this tool when you already know the target user and need to change profile or organization fields for that one person.

Required input:
- `user_id`

Optional update inputs:
- `email_id`
- `first_name`
- `last_name`
- `display_name`
- `phone`
- `mobile`
- `extension`
- `employee_id`
- `work_location`
- `language`
- `country`
- `timezone`
- `image_data`
- `department_id`
- `designation_id`
- `reporting_to_zuid`
- custom user fields keyed by unique field name

Input rules:
- `user_id` must be one exact existing Zoho Cliq user ID.
- Unlike some other User tools that may accept email address or ZUID identifiers, this tool requires user ID only.
- Update only the fields you want to change. Leave other optional fields blank so they are omitted.
- Use a real email address for `email_id` when changing the user's email.
- Use exact IDs for `department_id`, `designation_id`, and `reporting_to_zuid`. If you do not already have those IDs, look them up first with the appropriate list/get tools.
- `reporting_to_zuid` accepts one exact manager user ID or ZUID only. Do not pass an email address there.
- `language` must be a 2-letter ISO 639-1 code such as `en`.
- `country` must be a 2-letter ISO 3166-1 alpha-2 code such as `US`.
- `timezone` must be a valid IANA timezone such as `America/New_York`.
- Use `image_data` only when you already have Base64 image file content. Do not pass an image URL.
- Do not use this tool for channel membership or team membership changes. Use Channel or Team operations for those actions.
- When available in the toolset, use User Fields List first to discover valid custom user-field unique names before sending `custom_fields`.
- Omit optional fields you do not know instead of guessing.

Successful responses return a flat object with the most useful fields. Reuse `id`, `email_id`, or `zuid` with later User, Team, Role, or offboarding steps. Nested objects like `department` and `designation` are flattened to `department_name` and `designation_name`.

Example response:
{
  "id": "163315760",
  "email_id": "jordan.smith@zylker.com",
  "display_name": "Jordan Smith",
  "first_name": "Jordan",
  "last_name": "Smith",
  "status": "active",
  "timezone": "America/New_York",
  "country": "US",
  "department_name": "Engineering",
  "designation_name": "Developer"
}
```

### Simplify = Selected Fields

```txt
Update one existing user in Zoho Cliq. Use this tool when you already know the target user and need to change profile or organization fields for that one person.

Required input:
- `user_id`

Optional update inputs:
- `email_id`
- `first_name`
- `last_name`
- `display_name`
- `phone`
- `mobile`
- `extension`
- `employee_id`
- `work_location`
- `language`
- `country`
- `timezone`
- `image_data`
- `department_id`
- `designation_id`
- `reporting_to_zuid`
- custom user fields keyed by unique field name

Input rules:
- `user_id` must be one exact existing Zoho Cliq user ID.
- Unlike some other User tools that may accept email address or ZUID identifiers, this tool requires user ID only.
- Update only the fields you want to change. Leave other optional fields blank so they are omitted.
- Use a real email address for `email_id` when changing the user's email.
- Use exact IDs for `department_id`, `designation_id`, and `reporting_to_zuid`. If you do not already have those IDs, look them up first with the appropriate list/get tools.
- `reporting_to_zuid` accepts one exact manager user ID or ZUID only. Do not pass an email address there.
- `language` must be a 2-letter ISO 639-1 code such as `en`.
- `country` must be a 2-letter ISO 3166-1 alpha-2 code such as `US`.
- `timezone` must be a valid IANA timezone such as `America/New_York`.
- Use `image_data` only when you already have Base64 image file content. Do not pass an image URL.
- Do not use this tool for channel membership or team membership changes. Use Channel or Team operations for those actions.
- When available in the toolset, use User Fields List first to discover valid custom user-field unique names before sending `custom_fields`.
- Omit optional fields you do not know instead of guessing.

Successful responses return only the configured Output Fields. `id` is always included. Reuse `id` with later User, Team, Role, or offboarding steps.

Example response:
{
  "id": "163315760",
  "email_id": "jordan.smith@zylker.com",
  "display_name": "Jordan Smith"
}
```

### Simplify = Raw

```txt
Update one existing user in Zoho Cliq. Use this tool when you already know the target user and need to change profile or organization fields for that one person.

Required input:
- `user_id`

Optional update inputs:
- `email_id`
- `first_name`
- `last_name`
- `display_name`
- `phone`
- `mobile`
- `extension`
- `employee_id`
- `work_location`
- `language`
- `country`
- `timezone`
- `image_data`
- `department_id`
- `designation_id`
- `reporting_to_zuid`
- custom user fields keyed by unique field name

Input rules:
- `user_id` must be one exact existing Zoho Cliq user ID.
- Unlike some other User tools that may accept email address or ZUID identifiers, this tool requires user ID only.
- Update only the fields you want to change. Leave other optional fields blank so they are omitted.
- Use a real email address for `email_id` when changing the user's email.
- Use exact IDs for `department_id`, `designation_id`, and `reporting_to_zuid`. If you do not already have those IDs, look them up first with the appropriate list/get tools.
- `reporting_to_zuid` accepts one exact manager user ID or ZUID only. Do not pass an email address there.
- `language` must be a 2-letter ISO 639-1 code such as `en`.
- `country` must be a 2-letter ISO 3166-1 alpha-2 code such as `US`.
- `timezone` must be a valid IANA timezone such as `America/New_York`.
- Use `image_data` only when you already have Base64 image file content. Do not pass an image URL.
- Do not use this tool for channel membership or team membership changes. Use Channel or Team operations for those actions.
- When available in the toolset, use User Fields List first to discover valid custom user-field unique names before sending `custom_fields`.
- Omit optional fields you do not know instead of guessing.

Successful responses return a `data` object with the updated user profile. Reuse `data.id`, `data.email_id`, or `data.zuid` with later User, Team, Role, or offboarding steps. Reuse `data.designation.id`, `data.reportingto.id`, or `data.organization_id` when those relationship fields are present in the returned profile.

Example response:
{
  "data": {
    "id": "163315760",
    "email_id": "jordan.smith@zylker.com",
    "display_name": "Jordan Smith",
    "first_name": "Jordan",
    "last_name": "Smith",
    "zuid": "163315760",
    "organization_id": "631836344",
    "timezone": "America/New_York",
    "designation": {
      "id": "1901318000001072003",
      "name": "Developer"
    },
    "reportingto": {
      "id": "1901318000001072001",
      "email_id": "manager@zylker.com",
      "display_name": "Morgan Lee"
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
Required Zoho Cliq user ID for the profile you want to update. Pass one exact user ID only. Unlike some other User tools that may accept email address or ZUID identifiers, this tool requires user ID only. Example: 631830849. Use List Users first when you need to discover a valid user ID.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('user_id', 'Required Zoho Cliq user ID for the profile you want to update. Pass one exact user ID only. Unlike some other User tools that may accept email address or ZUID identifiers, this tool requires user ID only. Example: 631830849. Use List Users first when you need to discover a valid user ID.', 'string') }}
```

---

### Email ID (Optional)

- Plain text description:
```txt
Optional updated email address for the user. Leave blank to keep the current email unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('email_id', 'Optional updated email address for the user. Leave blank to keep the current email unchanged.', 'string', '') }}
```

---

### First Name (Optional)

- Plain text description:
```txt
Optional updated first name. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('first_name', 'Optional updated first name. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Last Name (Optional)

- Plain text description:
```txt
Optional updated last name. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('last_name', 'Optional updated last name. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Employee ID (Optional)

- Plain text description:
```txt
Optional updated organization-specific employee identifier. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('employee_id', 'Optional updated organization-specific employee identifier. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Nickname (Optional)

- Plain text description:
```txt
Optional updated Cliq nickname or display name. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('display_name', 'Optional updated Cliq nickname or display name. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Mobile (Optional)

- Plain text description:
```txt
Optional updated mobile number. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('mobile', 'Optional updated mobile number. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Phone (Optional)

- Plain text description:
```txt
Optional updated phone number. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('phone', 'Optional updated phone number. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Extension (Optional)

- Plain text description:
```txt
Optional updated desk-phone extension. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('extension', 'Optional updated desk-phone extension. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Image Data (Optional)

- Plain text description:
```txt
Optional Base64 image file content for the user's profile photo. Provide Base64 from the original image file bytes, not an image URL and not arbitrary Base64 text. A data URL is accepted only when it contains base64 image data. Leave blank to keep the current photo unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('image_data', 'Optional Base64 image file content for the user\'s profile photo. Provide Base64 from the original image file bytes, not an image URL and not arbitrary Base64 text. A data URL is accepted only when it contains base64 image data. Leave blank to keep the current photo unchanged.', 'string', '') }}
```

---

### Department ID (Optional)

- Plain text description:
```txt
Optional exact `department_id` for the user's department. A user can belong to only one department at a time. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('department_id', 'Optional exact `department_id` for the user\'s department. A user can belong to only one department at a time. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Designation ID (Optional)

- Plain text description:
```txt
Optional exact `designation_id` for the user's designation. A user can have only one designation at a time. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('designation_id', 'Optional exact `designation_id` for the user\'s designation. A user can have only one designation at a time. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Reporting To ZUID (Optional)

- Plain text description:
```txt
Optional exact manager user ID or ZUID for `reporting_to_zuid`. Do not pass an email address. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('reporting_to_zuid', 'Optional exact manager user ID or ZUID for `reporting_to_zuid`. Do not pass an email address. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Country (Alpha-2 Code) (Optional)

- Plain text description:
```txt
Optional 2-letter ISO 3166-1 alpha-2 `country` code such as `US`. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('country', 'Optional 2-letter ISO 3166-1 alpha-2 `country` code such as `US`. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Language (Alpha-2 Code) (Optional)

- Plain text description:
```txt
Optional 2-letter ISO 639-1 `language` code such as `en`. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('language', 'Optional 2-letter ISO 639-1 `language` code such as `en`. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Timezone (Optional)

- Plain text description:
```txt
Optional IANA `timezone` such as `America/New_York`. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('timezone', 'Optional IANA `timezone` such as `America/New_York`. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Work Location (Optional)

- Plain text description:
```txt
Optional updated `work_location` text. Leave blank to keep the current value unchanged.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('work_location', 'Optional updated `work_location` text. Leave blank to keep the current value unchanged.', 'string', '') }}
```

---

### Custom Fields (Optional)

- Plain text description:
```txt
Optional JSON object of custom user fields keyed by unique field name. Pass either a stringified JSON object or a literal JSON object. When available in the toolset, use User Fields List first to discover valid custom field unique names before sending this object. Do not include reserved standard keys such as `email_id`, `first_name`, `last_name`, `display_name`, `phone`, `mobile`, `timezone`, `language`, `country`, `designation_id`, `department_id`, `reporting_to_zuid`, `work_location`, `extension`, `employee_id`, or `image_data`. Do not include unsafe keys such as `__proto__`, `constructor`, or `prototype`. Use `{}` to omit custom fields.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('custom_fields', 'Optional JSON object of custom user fields keyed by unique field name. Pass either a stringified JSON object or a literal JSON object. When available in the toolset, use User Fields List first to discover valid custom field unique names before sending this object. Do not include reserved standard keys such as `email_id`, `first_name`, `last_name`, `display_name`, `phone`, `mobile`, `timezone`, `language`, `country`, `designation_id`, `department_id`, `reporting_to_zuid`, `work_location`, `extension`, `employee_id`, or `image_data`. Do not include unsafe keys such as `__proto__`, `constructor`, or `prototype`. Use {} to omit custom fields. Example: {"workplace_name":"Remote HQ"}', 'string', {}) }}
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
