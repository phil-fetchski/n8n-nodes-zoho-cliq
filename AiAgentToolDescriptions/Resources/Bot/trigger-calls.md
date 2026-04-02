# Bot: Trigger Bot Calls

Use this guide to configure **Trigger Bot Calls** for AI Agent Tool mode in n8n.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.

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
Trigger bot voice calls in Zoho Cliq. Use this to send a voice alert from a bot to specific users. Successful responses return the alert-trigger result, for example:
{
  "id": "ALERT_123456789",
  "user_ids": ["123456789", "987654321"]
}
At minimum, expect the response to contain the "id" and "user_ids" fields.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Bot Unique Name (Required by API)

- Plain text description:
```txt
Required. Cliq bot unique name used in the API path. Use lowercase letters only (a-z), with no numbers, spaces, or special characters. Do not use display name or bot ID.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('bot_unique_name', 'Required. Cliq bot unique name used in the API path. Use lowercase letters only (a-z), with no numbers, spaces, or special characters. Do not use display name or bot ID.', 'string') }}
```

---

### Input Mode (Manual Setting)

- Set this field manually to `Using Fields Below`.
- Do not use `$fromAI()` for this field.

---

### Text (Required)

- Plain text description:
```txt
Required. Voice alert message text spoken during the call. Maximum 500 characters.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('text', 'Required. Voice alert message text spoken during the call. Maximum 500 characters.', 'string') }}
```

---

### User IDs (Optional)

- Plain text description:
```txt
Optional. Comma-separated user IDs or emails (user_ids). Leave empty to call all subscribers. Maximum 10 entries.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('user_ids', 'Optional. Comma-separated user IDs or emails. Leave empty to call all subscribers. Maximum 10 entries.', 'string', '') }}
```

---

### Retry (Optional)

- Plain text description:
```txt
Optional. Retry attempts when a call is missed. Number from 1 to 3.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('retry', 'Optional. Retry attempts when a call is missed. Number from 1 to 3.', 'number', 2) }}
```

---

### Loop (Optional)

- Plain text description:
```txt
Optional. Number of times to repeat the voice message. Number from 1 to 3.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('loop', 'Optional. Number of times to repeat the voice message. Number from 1 to 3.', 'number', 1) }}
```

---

### Actions > Action Type (Optional Template)

- Plain text description:
```txt
Optional for Action 0. Action type for this button row. Valid values: open.url, invoke.function, system.api, open.dialog. Use invoke.function only when an exact custom Cliq function name is already known; otherwise choose another action type.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_type', 'Optional for Action 0. Action type. Valid values: open.url, invoke.function, system.api, open.dialog. Use invoke.function only if an exact deployed custom Cliq function name is known.', 'string', 'open.url') }}
```

---

### Actions > Label (Optional Template)

- Plain text description:
```txt
Optional for Action 0. Button label text. If this action row is used, provide a short label (max 20 chars) or the request will fail validation.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_label', 'Optional for Action 0. Button label text (max 20 chars). If this action row is used, provide a label or the request will fail.', 'string', '') }}
```

---

### Actions > Cliq Icon (Optional Template)

- Plain text description:
```txt
Optional for Action 0. Known Cliq icon keyword for the button. Use simple lowercase keywords; multi-word icons use hyphens. Examples: url, bus, calendar, light-bulb, location-pin.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_icon', 'Optional for Action 0. Known Cliq icon keyword. Use lowercase keywords; multi-word icons use hyphens (examples: url, bus, calendar, light-bulb, location-pin).', 'string', '') }}
```

---

### Actions > Hint (Optional Template)

- Plain text description:
```txt
Optional for Action 0. Short helper text shown with the button.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_hint', 'Optional for Action 0. Short helper text shown with the button.', 'string', '') }}
```

---

### Actions > Key (Optional Template)

- Plain text description:
```txt
Optional for Action 0. Key string for downstream handling.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_key', 'Optional for Action 0. Key string for downstream handling.', 'string', '') }}
```

---

### Actions > Open URL (Optional Template)

- Plain text description:
```txt
Optional for Action 0 when actionType is open.url. Full HTTP/HTTPS URL.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_open_url', 'Optional for Action 0 when actionType is open.url. Full HTTP/HTTPS URL.', 'string', '') }}
```

---

### Actions > Function Name (Optional Template)

- Plain text description:
```txt
Optional for Action 0 when actionType is invoke.function. Name of a custom Zoho Cliq function that is already created and deployed in your org. If no exact function name is known, do not use invoke.function.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_function_name', 'Optional for Action 0 when actionType is invoke.function. Name of a custom Zoho Cliq function that is already created and deployed. If no exact function name is known, do not use invoke.function.', 'string', '') }}
```

---

### Actions > System API (Optional Template)

- Plain text description:
```txt
Optional for Action 0 when actionType is system.api. Allowed action values: audiocall, videocall, startchat, invite, locationpermission. Format: {action}/{user_id} (example: audiocall/123456789).
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_system_api', 'Optional for Action 0 when actionType is system.api. Allowed actions: audiocall, videocall, startchat, invite, locationpermission. Format: {action}/{user_id}.', 'string', '') }}
```

---

### Actions > Dialog Data (JSON) (Optional Template)

- Plain text description:
```txt
Optional for Action 0 when actionType is open.dialog. Use this only when you want Zoho Cliq to open a confirmation dialog box so the user can review and confirm an action before it executes. The tool accepts either a stringified JSON object or a literal JSON object. Leave empty for other action types.

Use a dialog object with a confirm object shaped like:
{
  "confirm": {
    "title": "Required title, max 100 chars",
    "input": "Required prompt text, max 300 chars",
    "button_label": "Required confirm button label, max 100 chars",
    "description": "Optional message, max 100 chars",
    "cancel_button_label": "Optional cancel label, max 100 chars",
    "emotion": "Optional: positive | neutral | negative",
    "mandatory": "Optional string: true | false"
  }
}

Required inside confirm: title, input, button_label.
Optional inside confirm: description, cancel_button_label, emotion, mandatory.
Do not use boolean true/false for mandatory; the API documents it as the string values "true" or "false".
Use mandatory="true" when the user must type the requested input text before they can confirm the action, similar to destructive-action confirmation flows that require typing the resource name before deletion.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('action_0_dialog_data', 'Optional for Action 0 when actionType is open.dialog. Use this only when you want Zoho Cliq to open a confirmation dialog box so the user can review and confirm an action before it executes. The tool accepts either a stringified JSON object or a literal JSON object. Use a confirm object with title (required, max 100), input (required, max 300), button_label (required, max 100), optional description (max 100), optional cancel_button_label (max 100), optional emotion (positive | neutral | negative), and optional mandatory as the string values "true" or "false". Set mandatory to "true" when the user must type the requested input text before confirming the action. Leave empty for non-open.dialog actions.', 'string', {}) }}
```

For additional action rows, copy the same pattern for `action[1].*`, `action[2].*`, and so on. Keep each row optional, but if a row is used, provide required fields for that action type.

---

### App Key (Optional)

- Plain text description:
```txt
Optional. Marketplace extension app key. Required only for extension bots.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('app_key', 'Optional. Marketplace extension app key. Required only for extension bots.', 'string', '') }}
```

---

### Include Enhanced Output (Recommended)

- Plain text description:
```txt
Recommended. Set this to true so tool output always includes explicit success context for chaining and recovery.
```
- Set this field manually to `true` for AI tool usage.
- Do not use `$fromAI()` for this field.
