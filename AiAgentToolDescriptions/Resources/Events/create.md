# Events: Create Event

Use this guide to configure **Create Event** for AI Agent Tool mode in n8n.

This operation creates one event in Zoho Cliq.

- Set **Input Mode** to `Using JSON`.
- Use `Calendar ID` as a separate required top-level field. Use `Event Definition (JSON)` for the agent-controlled event payload, not the structured Title, Time, Timezone, Type, attendee, reminder, or attachment fields.
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
| ON | **Simplified** (default) | Most useful fields per item, nested objects flattened. |
| ON | **Raw** | Full API response as-is — single wrapper with array and pagination keys. |
| ON | **Selected Fields** | Only your chosen **Output Fields**. Record ID always included. |
| OFF | *(hidden)* | Full API response as-is (same as Raw). |

In **Simplified** or **Selected Fields** mode, each record is its own n8n output item (no Split Out needed). If pagination keys exist (`has_more`, `next_token`, `sync_token`), a `_pagination` object is prepended as the first item. In **Raw** mode, the response is a single wrapper object.

Configure Simplify, Simplify Mode, and Output Fields manually rather than delegating to the Agent. Three Tool Descriptions are provided below — **copy the one matching your Simplify mode**. The **Selected Fields** version is a template: edit its example response to list only the fields you configured in Output Fields. `$fromAI()` expressions are also provided if you prefer agent-controlled output.

---

## Providing Your Agent with DateTime Context

It is Important to provide your Agents with accurate DateTime Context when they are working with Tools that require accurate use of DateTime inputs like Calendar Event Creation and Updates. If you would like for your n8n Agent to use these tools effectively please insert the following into their **System Message** in the Main **Ai Agent** Node. The dynamic DateTime JavaScript expressions provided will resolve in the Ai Agent System Message, but they will NOT resolve when used in any of the Tool descriptions. If expressions like `{{ $now.toISO() }}` are inserted into the Tool Description your Agent will see the literal text of the expression and not its resolved values with current DateTime. This is ESSENTIAL for your Agent to Properly Create OR Update Calendar Events using accurate dates and times!

It is also strongly suggested that you let your Agent know your IANA Time Zone (i.e. America/New_York) as they will need to pass this value to the API when Creating and Updating Events. If you do not know the correct IANA Time Zone format you can reference this website -> [IANA Time Zone Reference Site](https://timeapi.io/documentation/iana-timezones) 

You can ensure that your Agent always has your IANA Time Zone in a few ways:

- Insert it into your Agent's System Message like "All of my Events should be created using my preferred Time Zone which is `America/New_York` do NOT use any other Time Zone when managing the Events in my Calendar"
  
- Use an `Edit Fields(Set)` node in n8n between the Workflow Trigger (usually Chat Input) and the Ai Agent node. Add a new field with a name like `myTimezone`, type 'String', and value with your time zone `America/New_York` and then reference that field in the Agent's System Message with a statement similar to the above example, but replace the fixed timezone value with {{ $json.myTimezone }}


### Insert the Following Into Your Agent's System Message
```txt
## IMPORTANT DATE TIME CONTEXT

The Current Date in ISO 8601 format is {{ $now.toISO() }} When the user says "tomorrow," "next Monday," or any relative date, resolve it against today's date ({{ $now.toISO() }}) explicitly. NEVER invent a date. If you cannot determine the specific intended date from the user's request, ASK. When you are tasked with generating dates for Calendar Events it is CRUCIAL that you create or edit those Calendar Events with accurate dates for the Event at hand. Time and Timezone are CRITICAL to the Calendar Event being scheduled correctly. If you know the user's preferred IANA Timezone (i.e. America/New_York) use it explicitly as the timezone when creating Events. If the user's preferred timezone is unknown, infer the most likely IANA timezone from the user's locale, location, or stated offset and provide that timezone. There is NO room for guessing about dates and times when charged with managing a user's calendar events. Ensure that you get the date time correct. Calendar Events must be in the future, ensure that any dates that you provide for Event start_time and end_time come after the current time {{ $now.toISO() }} or they will be rejected by the API.
```

---

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

Use the Tool Description that matches your configured **Simplify** mode:

### Simplify = Simplified (default)

```txt
Create one event in Zoho Cliq using `calendar_id` plus a raw JSON event-definition object. Required JSON fields are title, start_time, end_time, and timezone. Optional JSON fields include type, attendees, location, description, reminders, and attachment_ids. Successful responses return individual event items with the most useful fields. The nested `organizer.name` and `organizer.email` fields are flattened to `organizer_name` and `organizer_email`. Reuse `id` as `event_id` for update or delete. Note: `calendar_id`, `meeting_link`, and `meeting_details` are not included in Simplified output. If you need those fields, use Raw mode or include them in Selected Fields.

IMPORTANT: Calendar Events are meant to record events that are to happen in the future, not events that have already occurred. It is essential that you remember that Calendar Events are for the future when creating or editing them, and even more essential that you know an actual specific date for the event that you want to create or edit, and that specific date is in the future. The Zoho Cliq API will reject any start_time or end_time timestamps that are past dates. DO NOT CREATE OR EDIT A CALENDAR EVENT WITH PAST DATED TIMESTAMPS OR A MADE UP DATE, EVER.

When you provide start_time and end_time, always use ISO 8601 datetime strings with an explicit UTC offset, such as `2026-03-20T15:00:00-04:00`. Do not send Unix timestamps. The node converts the ISO 8601 value to epoch milliseconds before sending the API request.

Include the matching IANA timezone in the `timezone` key of the event definition JSON, for example `America/New_York` for `-04:00` during Eastern Daylight Time. If the user's preferred timezone is not already known from context, infer the most likely IANA timezone from the user's locale, location, or stated offset and provide that timezone explicitly.

Example response:
[
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
]
```

### Simplify = Selected Fields

```txt
Create one event in Zoho Cliq using `calendar_id` plus a raw JSON event-definition object. Required JSON fields are title, start_time, end_time, and timezone. Optional JSON fields include type, attendees, location, description, reminders, and attachment_ids. Successful responses return individual event items with only the configured Output Fields. `id` is always included. Reuse `id` as the event_id for follow-up calls.

IMPORTANT: Calendar Events are meant to record events that are to happen in the future, not events that have already occurred. DO NOT CREATE A CALENDAR EVENT WITH PAST DATED TIMESTAMPS OR A MADE UP DATE, EVER.

When you provide start_time and end_time, always use ISO 8601 datetime strings with an explicit UTC offset, such as `2026-03-20T15:00:00-04:00`. Use the matching IANA timezone such as `America/New_York`.

Example response:
[
  {
    "id": "427812df9891223aca537f0e8e7ad2a7c@zoho.com",
    "title": "Zylker Marketing Forum",
    "calendar_id": "NDg4MTc3NTAwMDAwMDAwOTAwM3wzMzMyY2NjMQ=="
  }
]
```

### Simplify = Raw

```txt
Create one event in Zoho Cliq using `calendar_id` plus a raw JSON event-definition object. Required JSON fields are title, start_time, end_time, and timezone. Optional JSON fields include type, attendees, location, description, reminders, and attachment_ids. Successful responses return a `data` array of event objects with all available fields. Reuse `data[0].id` as the event_id for update or delete, reuse `data[0].calendar_id` as the calendar_id, and reuse `data[0].edit_tag` from a later get-details response before delete operations.

IMPORTANT: Calendar Events are meant to record events that are to happen in the future, not events that have already occurred. It is essential that you remember that Calendar Events are for the future when creating or editing them, and even more essential that you know an actual specific date for the event that you want to create or edit, and that specific date is in the future. The Zoho Cliq API will reject any start_time or end_time timestamps that are past dates. DO NOT CREATE OR EDIT A CALENDAR EVENT WITH PAST DATED TIMESTAMPS OR A MADE UP DATE, EVER.

When you provide start_time and end_time, always use ISO 8601 datetime strings with an explicit UTC offset, such as `2026-03-20T15:00:00-04:00`. Do not send Unix timestamps. The node converts the ISO 8601 value to epoch milliseconds before sending the API request.

Include the matching IANA timezone in the `timezone` key of the event definition JSON, for example `America/New_York` for `-04:00` during Eastern Daylight Time. If the user's preferred timezone is not already known from context, infer the most likely IANA timezone from the user's locale, location, or stated offset and provide that timezone explicitly.

When setting the Event `type` to either `video_conference` or `audio_conference` the API response will also include a meeting_link and a meeting_details object in the response. Treat both as important output: note them, preserve them, and pass them along when relevant. They contain the conference join information and related meeting metadata.

For example:
{
  "data": [
    {
      "id": "427812df9891223aca537f0e8e7ad2a7c@zoho.com",
      "calendar_id": "NDg4MTc3NTAwMDAwMDAwOTAwM3wzMzMyY2NjMQ==",
      "title": "Zylker Marketing Forum",
      "type": "video_conference",
      "timezone": "Asia/Kolkata",
      "start_time": 1738938600000,
      "end_time": 1738942200000,
      "meeting_link": "https://cliq.glencadia.com/meeting/1CI1MFX2BATW",
      "meeting_details": {...}
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

### Calendar ID (Required)

- Plain text description:
```txt
Required exact Zoho Cliq calendar ID where the new event should be created. Use the exact calendar_id returned by Get Event Calendars or from another event response.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('calendar_id', 'Required exact Zoho Cliq calendar ID where the new event should be created. Use the exact calendar_id returned by Get Event Calendars or from another event response.', 'string') }}
```

---

### Event Definition (JSON) (Required When Input Mode = Using JSON)

- Plain text description:
```txt
Required top-level Zoho Cliq event JSON object. This tool accepts either a stringified JSON object or a literal JSON object. Required keys are title, start_time, end_time, and timezone. Optional keys are type, attendees, location, description, reminders, and attachment_ids. Do not include calendar_id here; use the separate required Calendar ID field instead. Always send start_time and end_time as ISO 8601 datetime strings with an explicit UTC offset, for example `2026-03-20T15:00:00-04:00`. Also provide the matching IANA timezone such as `America/New_York`. If the user's preferred timezone is unknown, infer the most likely IANA timezone from the user's locale, location, or stated offset and provide that timezone explicitly. type ENUM: ["normal_event", "event_management", "audio_conference", "video_conference"]. Note: For Create, attendees is an array of plain email strings, for example ["user@example.com"]. This differs from Update Event, which takes attendees as an array of objects. If reminders are provided, use reminder objects with type `email` and a positive whole-number minutes value. Default reminder type to `email` for agent use. attachment_ids must be an array of uploaded event attachment ID strings. Use the fileId values returned by the Upload Event Attachment tool as entries in the attachment_ids array. Unsafe keys such as __proto__, constructor, and prototype are rejected.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('event_definition', 'Required top-level Zoho Cliq event JSON object. This tool accepts either a stringified JSON object or a literal JSON object. Required keys are title, start_time, end_time, and timezone. Optional keys are type, attendees, location, description, reminders, and attachment_ids. Do not include calendar_id here; use the separate required Calendar ID field instead. Always send start_time and end_time as ISO 8601 datetime strings with an explicit UTC offset, for example 2026-03-20T15:00:00-04:00. Also provide the matching IANA timezone such as America/New_York. If the user\'s preferred timezone is unknown, infer the most likely IANA timezone from the user\'s locale, location, or stated offset and provide that timezone explicitly. type ENUM: [\"normal_event\", \"event_management\", \"audio_conference\", \"video_conference\"]. Note: For Create, attendees is an array of plain email strings, for example [\"user@example.com\"]. This differs from Update Event, which takes attendees as an array of objects. If reminders are provided, use reminder objects with type `email` and a positive whole-number minutes value. Default reminder type to `email` for agent use. attachment_ids must be an array of uploaded event attachment ID strings. Use the fileId values returned by the Upload Event Attachment tool as entries in the attachment_ids array.', 'string') }}
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
