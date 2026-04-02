# User: Create User

Use this guide to configure **Create User** for AI Agent Tool mode in n8n.

This operation creates one user in Zoho Cliq using the dedicated AI-friendly flattened field mode.

- Set **Input Mode** to `Agent/Tool Setup Fields`.
## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Do not delegate **Input Mode** to the agent.

This mode renders the Create User inputs together in one flattened form so the agent can fill normal user fields directly instead of constructing the raw `users` wrapper itself.

## Alternative Setup Option: Using JSON (Advanced)

If you prefer one agent-controlled JSON object, you can instead set **Input Mode** to `Using JSON` and use **Users Payload (JSON)**.

That Using JSON option is not the recommended AI Tool setup for this operation.

- Use **Agent/Tool Setup Fields** when you want the best AI-facing setup contract for one-user creation.
- The Using JSON option is better only when the agent truly needs to build the full API wrapper itself or create multiple users in one call.
- Using JSON still supports **AI Error Mode** and basic JSON/body validation, but it does not get the same flattened field guidance, comma-split helper behavior, or the improved optional-target preflight recovery guidance that the recommended **Agent/Tool Setup Fields** mode can provide.
- Choose one setup style only. Do not mix the flattened agent fields with **Users Payload (JSON)** in the same tool.

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
Create one new user in Zoho Cliq. Use this tool when you want to provision a person in the organization and optionally place them into the correct department, designation, manager relationship, channels, and teams at creation time.

Required input:
- `email_id`

Optional profile inputs:
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

Optional organization and membership inputs:
- `department_id`
- `designation_id`
- `reporting_to_zuid`
- `channel_ids`
- `team_ids`
- custom user fields keyed by unique field name

Input rules:
- Use a real and accurate email address for `email_id`.
- Use exact IDs for `department_id`, `designation_id`, `reporting_to_zuid`, `channel_ids`, and `team_ids`. If you do not already have those IDs, look them up first with the appropriate list/get tools.
- `reporting_to_zuid` accepts one exact manager user ID or ZUID only. Do not pass an email address there.
- `channel_ids` and `team_ids` should be comma-separated exact IDs.
- `language` must be a 2-letter ISO 639-1 code such as `en`.
- `country` must be a 2-letter ISO 3166-1 alpha-2 code such as `US`.
- `timezone` must be a valid IANA timezone such as `America/New_York`.
- Use `image_data` only when you already have Base64 image file content. Do not pass an image URL.
- When available in the toolset, use User Fields List first to discover valid custom user-field unique names before sending `custom_fields`.
- Omit optional fields you do not know instead of guessing.

Successful responses return `data.success_users` and `data.failed_users`. In this recommended one-user setup, a successful create should place the created user's email address in `data.success_users[0]`. Reuse that single email address with List Users or Get User to fetch canonical identifiers such as `id`, `zuid`, or `zoid` for later tool chaining. If creation fails, inspect `data.failed_users` for the failure details for that user.

Example response:
{
  "data": {
    "success_users": [
      "amy@zylker.com"
    ],
    "failed_users": {}
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

### Email ID (Required)

- Plain text description:
```txt
Required email address for the new user. Use a normal email format such as `amy@zylker.com`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('email_id', 'Required email address for the new user. Use a normal email format such as `amy@zylker.com`.', 'string') }}
```

---

### First Name (Optional)

- Plain text description:
```txt
Optional first name for the user. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('first_name', 'Optional first name for the user. Leave blank to omit.', 'string', '') }}
```

---

### Last Name (Optional)

- Plain text description:
```txt
Optional last name for the user. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('last_name', 'Optional last name for the user. Leave blank to omit.', 'string', '') }}
```

---

### Employee ID (Optional)

- Plain text description:
```txt
Optional organization-specific employee identifier. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('employee_id', 'Optional organization-specific employee identifier. Leave blank to omit.', 'string', '') }}
```

---

### Nickname (Optional)

- Plain text description:
```txt
Optional Cliq nickname or display name for the user. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('display_name', 'Optional Cliq nickname or display name for the user. Leave blank to omit.', 'string', '') }}
```

---

### Mobile (Optional)

- Plain text description:
```txt
Optional mobile number for the user. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('mobile', 'Optional mobile number for the user. Leave blank to omit.', 'string', '') }}
```

---

### Phone (Optional)

- Plain text description:
```txt
Optional phone number for the user. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('phone', 'Optional phone number for the user. Leave blank to omit.', 'string', '') }}
```

---

### Extension (Optional)

- Plain text description:
```txt
Optional desk-phone extension for the user. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('extension', 'Optional desk-phone extension for the user. Leave blank to omit.', 'string', '') }}
```

---

### Image Data (Optional)

- Plain text description:
```txt
Optional Base64 image file content for the user's profile photo. Provide Base64 from the original image file bytes, not an image URL and not arbitrary Base64 text. A data URL is accepted only when it contains base64 image data. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('image_data', 'Optional Base64 image file content for the user\'s profile photo. Provide Base64 from the original image file bytes, not an image URL and not arbitrary Base64 text. A data URL is accepted only when it contains base64 image data. Leave blank to omit.', 'string', '') }}
```

---

### Channel IDs (Optional)

- Plain text description:
```txt
Optional comma-separated exact Zoho Cliq channel IDs to add the user to after creation. Example: `P5551011000000555001,P5552022000000555002`. Leave blank to omit. Invalid values can return `CHANNEL_NOT_FOUND`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_ids', 'Optional comma-separated exact Zoho Cliq channel IDs to add the user to after creation. Example: `P5551011000000555001,P5552022000000555002`. Leave blank to omit. Invalid values can return `CHANNEL_NOT_FOUND`.', 'string', '') }}
```

---

### Department ID (Optional)

- Plain text description:
```txt
Optional exact `department_id` for the user's department. A user can belong to only one department at a time. Leave blank to omit. Invalid values can return `DEPARTMENT_NOT_FOUND`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('department_id', 'Optional exact `department_id` for the user\'s department. A user can belong to only one department at a time. Leave blank to omit. Invalid values can return `DEPARTMENT_NOT_FOUND`.', 'string', '') }}
```

---

### Designation ID (Optional)

- Plain text description:
```txt
Optional exact `designation_id` for the user's designation. A user can have only one designation at a time. Leave blank to omit. Invalid values can return `DESIGNATION_NOT_FOUND`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('designation_id', 'Optional exact `designation_id` for the user\'s designation. A user can have only one designation at a time. Leave blank to omit. Invalid values can return `DESIGNATION_NOT_FOUND`.', 'string', '') }}
```

---

### Reporting To ZUID (Optional)

- Plain text description:
```txt
Optional exact manager user ID or ZUID for `reporting_to_zuid`. Do not pass an email address. Leave blank to omit. Invalid values can return `USER_NOT_FOUND`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('reporting_to_zuid', 'Optional exact manager user ID or ZUID for `reporting_to_zuid`. Do not pass an email address. Leave blank to omit. Invalid values can return `USER_NOT_FOUND`.', 'string', '') }}
```

---

### Team IDs (Optional)

- Plain text description:
```txt
Optional comma-separated exact Zoho Cliq team IDs to add the user to. Example: `876543210,876543211`. Leave blank to omit. Invalid values can return `TEAM_NOT_FOUND`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('team_ids', 'Optional comma-separated exact Zoho Cliq team IDs to add the user to. Example: `876543210,876543211`. Leave blank to omit. Invalid values can return `TEAM_NOT_FOUND`.', 'string', '') }}
```

---

### Country (Alpha-2 Code) (Optional)

- Plain text description:
```txt
Optional ISO 3166-1 alpha-2 country code such as `US`. Use exactly 2 letters. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('country', 'Optional ISO 3166-1 alpha-2 country code such as `US`. Use exactly 2 letters. Leave blank to omit.', 'string', '') }}
```

---

### Language (Alpha-2 Code) (Optional)

- Plain text description:
```txt
Optional ISO 639-1 two-letter language code such as `en`. Use exactly 2 letters. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('language', 'Optional ISO 639-1 two-letter language code such as `en`. Use exactly 2 letters. Leave blank to omit.', 'string', '') }}
```

---

### Timezone (Optional)

- Plain text description:
```txt
Optional IANA timezone identifier such as `America/New_York`. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('timezone', 'Optional IANA timezone identifier such as `America/New_York`. Leave blank to omit.', 'string', '') }}
```

---

### Work Location (Optional)

- Plain text description:
```txt
Optional work-location text such as `Chennai Office` or `Remote`. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('work_location', 'Optional work-location text such as `Chennai Office` or `Remote`. Leave blank to omit.', 'string', '') }}
```

---

### Custom Fields (Optional)

- Plain text description:
```txt
Optional custom user-fields object keyed by unique names, for example `{"workplace_name":"HQ"}`. Pass either a stringified JSON object or a literal JSON object. When available in the toolset, use User Fields List first to discover valid custom field unique names before sending this object. Leave blank or use `{}` to omit. Do not use reserved keys such as `email_id`, `department_id`, `team_ids`, `channel_ids`, or unsafe keys such as `__proto__`, `constructor`, or `prototype`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('custom_fields', 'Optional custom user-fields object keyed by unique names, for example `{\"workplace_name\":\"HQ\"}`. Pass either a stringified JSON object or a literal JSON object. When available in the toolset, use User Fields List first to discover valid custom field unique names before sending this object. Leave blank or use `{}` to omit. Do not use reserved keys such as `email_id`, `department_id`, `team_ids`, `channel_ids`, or unsafe keys such as `__proto__`, `constructor`, or `prototype`.', 'string', {}) }}
```
