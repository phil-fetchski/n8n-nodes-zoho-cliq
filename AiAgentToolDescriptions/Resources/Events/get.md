# Events: Get Event Details

Use this guide to configure **Get Event Details** for AI Agent Tool mode in n8n.

This operation retrieves one event from Zoho Cliq by `event_id` and `calendar_id`.

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
Get one event in Zoho Cliq by `event_id` and `calendar_id`. Optional `recurrence_id` can target a single recurring instance. Returns a flat object with the most useful fields. The nested `organizer.name` and `organizer.email` fields are flattened to `organizer_name` and `organizer_email`. Reuse `id` as `event_id` for update or delete. Note: `calendar_id` is not included in Simplified output. If you need `calendar_id` for follow-up calls, use Raw mode or include `calendar_id` in Selected Fields.

For example:
{
  "id": "427812df9891223aca537f0e8e7ad2a7c@zoho.com",
  "title": "Zylker Marketing Forum",
  "type": "video_conference",
  "start_time": 1738938600000,
  "end_time": 1738942200000,
  "timezone": "Asia/Kolkata",
  "isallday": false,
  "role": "organizer",
  "organizer_name": "Example User",
  "organizer_email": "user@example.com"
}
```

### Simplify = Selected Fields

```txt
Get one event in Zoho Cliq by `event_id` and `calendar_id`. Optional `recurrence_id` can target a single recurring instance. Returns only the configured Output Fields. `id` is always included. Reuse `id` as `event_id` for follow-up calls.

For example:
{
  "id": "427812df9891223aca537f0e8e7ad2a7c@zoho.com",
  "title": "Zylker Marketing Forum",
  "type": "video_conference"
}
```

### Simplify = Raw

```txt
Get one event in Zoho Cliq by `event_id` and `calendar_id`. Optional `recurrence_id` can target a single recurring instance. Returns the full event object with all available fields. Reuse `data.id` as the event_id for update or delete, reuse `data.calendar_id` as the calendar_id, and reuse `data.edit_tag` before delete operations.

For example:
{
  "data": {
    "id": "427812df9891223aca537f0e8e7ad2a7c@zoho.com",
    "calendar_id": "NDg4MTc3NTAwMDAwMDAwOTAwM3wzMzMyY2NjMQ==",
    "edit_tag": "1738835150914",
    "title": "Zylker Marketing Forum",
    "type": "video_conference",
    "timezone": "Asia/Kolkata",
    "start_time": 1738938600000,
    "end_time": 1738942200000,
    "isallday": false,
    "role": "organizer",
    "location": "Conference Room A",
    "description": "Quarterly marketing strategy review",
    "organizer": {
      "name": "Example User",
      "email": "user@example.com"
    },
    "creator": { "name": "Example User", "email": "user@example.com" },
    "attendees": [],
    "meeting_link": "https://cliq.zoho.com/meeting/1CI1MFX2BATW",
    "meeting_details": {},
    "recurrence_rule": ""
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

### Event ID (Required)

- Plain text description:
```txt
Required exact Zoho Cliq event ID to retrieve, for example 427812df9891223aca537f0e8e7ad2a7c@zoho.com.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('event_id', 'Required exact Zoho Cliq event ID to retrieve, for example 427812df9891223aca537f0e8e7ad2a7c@zoho.com.', 'string') }}
```

---

### Calendar ID (Required)

- Plain text description:
```txt
Required exact Zoho Cliq calendar ID that owns the event, for example NDg4MTc3NTAwMDAwMDAwOTAwM3wzMzMyY2NjMQ==.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('calendar_id', 'Required exact Zoho Cliq calendar ID that owns the event, for example NDg4MTc3NTAwMDAwMDAwOTAwM3wzMzMyY2NjMQ==.', 'string') }}
```

---

### Recurrence ID (Optional)

- Plain text description:
```txt
Optional recurrence instance identifier for recurring events, for example 20250210T050000Z. Leave blank for non-recurring events or when the base event is sufficient. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('recurrence_id', 'Optional recurrence instance identifier for recurring events, for example 20250210T050000Z. Leave blank for non-recurring events or when the base event is sufficient.', 'string', '') }}
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
Fields to include in the output when Simplify Mode is set to Selected Fields. The id is always included. Available fields: id, title, type, start_time, end_time, start_date, end_date, timezone, location, description, isallday, is_status_break, entity_id, is_big_chat_event, entity_type, creator, attendees, edit_tag, calendar_id, organizer, role, meeting_link, meeting_details, recurrence_id, recurrence_rule, chat_id.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('simplifyFields', 'Fields to include in the output. Available: id, title, type, start_time, end_time, start_date, end_date, timezone, location, description, isallday, is_status_break, entity_id, is_big_chat_event, entity_type, creator, attendees, edit_tag, calendar_id, organizer, role, meeting_link, meeting_details, recurrence_id, recurrence_rule, chat_id. Return a JSON array of field names (e.g. ["id","title"]) or a comma-separated string (e.g. "id,title"). Both formats are accepted.', 'string', '["id"]') }}
```
