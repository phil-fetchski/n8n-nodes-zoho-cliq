# Role: Update Role Permissions

Use this guide to configure **Update Role Permissions** for AI Agent Tool mode in n8n.

This operation sends an advanced raw JSON role-permissions update request in Zoho Cliq.

Use this as the Roles permissions operation you expose to AI agents.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.

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
Update one role-permissions payload in Zoho Cliq using a canonical role ID and a JSON object with a non-empty list array. You should not attempt to use this Tool without first having used the Get Role Permissions Tool to understand the exact Permissions for a Role. Do NOT guess permissions or permissions structures ever. 

Always use Get Role Permissions Tool first, then translate the permission state you want to change into list rows for this operation. Map a top-level module status such as extensions.status = "enabled" into {"module":"extensions","status":"disabled"} when you want to disable the whole module. Map a nested action such as group_audio_call.actions.start = "enabled" into {"module":"group_audio_call","action":"start","status":"disabled"} when you want to change one action only. Use configs only for configuration-style permission updates that require a configs array.

Unsupported modules, read-only actions, empty custom_rule configs, and rows with no effective update are filtered out before the API call. Successful responses return success, resource, operation, roleId, permissionCount, sanitizedPermissionCount, filteredOutCount, filteredEntries, batched, batchCount, and apiResponse. Reuse filteredEntries for audit/debugging and reuse the same roleId with Get Role Permissions when you want to verify the final state after the update.
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
Required canonical role ID in Zoho Cliq. Use the exact role ID whose permissions you want to update, for example 42405000000224001.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('role_id', 'Required canonical role ID in Zoho Cliq. Use the exact role ID whose permissions you want to update, for example 42405000000224001.', 'string') }}
```

---

### Enable Batch Updates (Optional)

- Plain text description:
```txt
Optional boolean in Zoho Cliq. Use true when the permissions list is large and should be sent in multiple sequential API requests. Use false for a single request.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('enable_batch_updates', 'Optional boolean in Zoho Cliq. Use true when the permissions list is large and should be sent in multiple sequential API requests. Use false for a single request.', 'boolean', false) }}
```

---

### Batch Size (Optional)

- Plain text description:
```txt
Optional whole-number batch size in Zoho Cliq. This field stays visible even when Enable Batch Updates is set by expression. The value is only used when Enable Batch Updates is true. Minimum 1. Maximum 200. Default 50.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('batch_size', 'Optional whole-number batch size in Zoho Cliq. This field stays visible even when Enable Batch Updates is set by expression. The value is only used when Enable Batch Updates is true. Minimum 1. Maximum 200. Default 50.', 'number', 50) }}
```

---

### Wait Between Batches (Milliseconds) (Optional)

- Plain text description:
```txt
Optional whole-number wait time in milliseconds between Zoho Cliq permission-update batches. This field stays visible even when Enable Batch Updates is set by expression. The value is only used when Enable Batch Updates is true. Minimum 0. Maximum 120000. Default 300.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('batch_wait_ms', 'Optional whole-number wait time in milliseconds between Zoho Cliq permission-update batches. This field stays visible even when Enable Batch Updates is set by expression. The value is only used when Enable Batch Updates is true. Minimum 0. Maximum 120000. Default 300.', 'number', 300) }}
```

---

### Permissions Updates (JSON) (Required)

- Plain text description:
```txt
Required top-level JSON object for a Zoho Cliq role-permissions update request. Pass either a JSON-encoded string or a native JSON object. The object must contain a non-empty list array. Each row must include module, optional action, optional status, and optional configs. status, when provided, must be one of ENUM: ["enabled", "disabled"]. If you are changing a nested action from Get Role Permissions, send module plus action plus status, for example {"module":"group_audio_call","action":"start","status":"disabled"}. If you are changing a top-level module status from Get Role Permissions, send module plus status only, for example {"module":"extensions","status":"disabled"}. configs, when provided, must be a non-empty array of objects with name and value. Unsupported module custom_admin is filtered out. Read-only action get is filtered out. Empty custom_rule configs with both enabled and disabled arrays empty are filtered out. Rows with no effective status/config change after sanitization are filtered out. Example payload: {"list":[{"module":"extensions","status":"disabled"},{"module":"group_audio_call","action":"start","status":"disabled"},{"module":"direct_message","configs":[{"name":"profile_based_restricted_reply_time_frame","value":345600000}]}]}
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('permission_updates', 'Required top-level JSON object for a Zoho Cliq role-permissions update request. The object must contain a non-empty list array. Each row must include module, optional action, optional status, and optional configs. status, when provided, must be one of ENUM: [\"enabled\", \"disabled\"]. If you are changing a nested action from Get Role Permissions, send module plus action plus status, for example {\"module\":\"group_audio_call\",\"action\":\"start\",\"status\":\"disabled\"}. If you are changing a top-level module status from Get Role Permissions, send module plus status only, for example {\"module\":\"extensions\",\"status\":\"disabled\"}. configs, when provided, must be a non-empty array of objects with name and value. Unsupported module custom_admin is filtered out. Read-only action get is filtered out. Empty custom_rule configs with both enabled and disabled arrays empty are filtered out. Rows with no effective status/config change after sanitization are filtered out. Pass either a JSON-encoded string or a native JSON object. Example payload: {\"list\":[{\"module\":\"extensions\",\"status\":\"disabled\"},{\"module\":\"group_audio_call\",\"action\":\"start\",\"status\":\"disabled\"},{\"module\":\"direct_message\",\"configs\":[{\"name\":\"profile_based_restricted_reply_time_frame\",\"value\":345600000}]}]}', 'string') }}
```
