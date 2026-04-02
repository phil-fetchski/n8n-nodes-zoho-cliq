# Role: Create Role

Use this guide to configure **Create Role** for AI Agent Tool mode in n8n.

This operation creates one role in Zoho Cliq.

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
Create one role in Zoho Cliq using structured fields. Use this when the role does not exist yet. Required inputs are Name and Profile Type. Optional inputs are Description, Clone Permissions from Role, and comma-separated User IDs. Profile Type must be one of ENUM: ["Members", "Cliq Admin", "Admin"]. Members has no admin access. Cliq Admin has Cliq admin access without full organization resource access. Admin has full organization admin access. Clone Permissions from Role must be a canonical Zoho Cliq role ID if provided. If you do not provide a `clone_role_id` to clone permissions from, the newly created role will automatically be given the default Cliq Member role permissions, which may differ from this Account's current default Member role permissions. User IDs must be canonical Zoho Cliq user IDs separated by commas if provided. Successful responses return a data object that typically includes data.id, data.name, data.profile_type, data.creation_time, data.last_modified_time, data.organization_id, data.is_default, and data.is_custom_admin.

Example response:
{
  "data": {
    "name": "Marketing",
    "id": "42405000000224001",
    "profile_type": "Cliq Admin",
    "creation_time": "2022-05-16T18:03:51+05:30",
    "last_modified_time": "2022-05-16T18:03:51+05:30",
    "organization_id": "62914174",
    "is_default": false,
    "description": "Role for Marketing members",
    "is_custom_admin": true
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

### Name (Required)

- Plain text description:
```txt
Required role name in Zoho Cliq. Provide a non-empty name up to 120 characters, for example Marketing.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('role_name', 'Required role name in Zoho Cliq. Provide a non-empty name up to 120 characters, for example Marketing.', 'string') }}
```

---

### Profile Type (Required)

- Plain text description:
```txt
Required Zoho Cliq profile type for the new role. Use one of ENUM: ["Members", "Cliq Admin", "Admin"]. Members has no admin access. Cliq Admin has Cliq admin access without full organization resource access. Admin has full organization admin access.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('profile_type', 'Required Zoho Cliq profile type for the new role. Use one of ENUM: [\"Members\", \"Cliq Admin\", \"Admin\"]. Members has no admin access. Cliq Admin has Cliq admin access without full organization resource access. Admin has full organization admin access.', 'string') }}
```

---

### Clone Permissions from Role (Optional)

- Plain text description:
```txt
Optional canonical Zoho Cliq role ID to clone permissions from when creating the new role, for example 42405000000223003. Leave blank to create the role without copying permissions from another role.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('clone_role_id', 'Optional canonical Zoho Cliq role ID to clone permissions from when creating the new role, for example 42405000000223003. Leave blank to create the role without copying permissions from another role.', 'string', '') }}
```

---

### Description (Optional)

- Plain text description:
```txt
Optional role description in Zoho Cliq. Leave blank to omit. Maximum length is 1000 characters.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('role_description', 'Optional role description in Zoho Cliq. Leave blank to omit. Maximum length is 1000 characters.', 'string', '') }}
```

---

### User IDs (Optional)

- Plain text description:
```txt
Optional comma-separated canonical Zoho Cliq user IDs to assign to the new role immediately after creation, for example 62913657,63569660. Leave blank to omit. Provide at most 100 IDs. Duplicate IDs are removed automatically.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('user_ids', 'Optional comma-separated canonical Zoho Cliq user IDs to assign to the new role immediately after creation, for example 62913657,63569660. Leave blank to omit. Provide at most 100 IDs. Duplicate IDs are removed automatically.', 'string', '') }}
```
