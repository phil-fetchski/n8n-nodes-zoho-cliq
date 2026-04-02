# BulkAction: Export Channels

Use this guide to configure **Export Channels** for AI Agent Tool mode in n8n.

This operation exports organization-wide channel records from Zoho Cliq.

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

## Bulk Export Warnings

> Read this before setting up this tool for AI use:
>
> - These Maintenance / Bulk Export endpoints are accessible only to a Zoho Cliq Organization Admin (Super Admin). Do not attempt to use this tool unless you know for certain that the connected Zoho Cliq OAuth credential belongs to an Organization Admin and already has the required scopes authorized in n8n.
> - AI Agent use is not recommended by default for these bulk export tools. These exports can be very large, and the returned payload can exceed practical LLM context limits very quickly.
> - Bulk exports can expose complete organizational conversation data to the model that powers your AI Agent. Consider privacy, internal sensitivity, participant expectations, and whether the full exported content should ever be handed to an LLM at all.
> - Minimize the selected export fields as much as possible. Giving the agent clear field constraints, or manually hardcoding the exact fields instead of delegating them, is one of the best ways to reduce token usage and unnecessary data exposure.
> - If your real goal is scheduled backup or archival, a deterministic n8n workflow with a Schedule Trigger plus a storage destination such as a database is usually a better fit than asking an AI Agent to run maintenance exports.
> - These setup instructions are still provided because there are legitimate use cases for careful, narrow AI-assisted bulk export access. Use them only with clear intent and tight scope control.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Export channels in Zoho Cliq using one or more selected channel fields. This is a maintenance export for organization-wide channel records, not a single channel lookup.

This operation returns CSV export text, and the node exposes that CSV text under `csv`. Expect a response like:
{
  "csv": "name,channel_id,participant_count\n#announcements,15928000000004007,600"
}

Parse the CSV text from `csv` to reuse returned columns such as `channel_id` in later Zoho Cliq channel steps.

When a larger export has more pages, Zoho may append `\n\n\nnext_token=<token>` at the end of the CSV text. Reuse that token exactly in Next Token to fetch the next page.

Important: Maintenance/Bulk Export APIs are available only for the Zoho Cliq Organization Admin (Super Admin) and require the "Org Admin (Organization APIs)" scope pack. Calls from non-admin OAuth users will fail.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Channel Fields (Optional)

- Plain text description:
```txt
Channel fields to include in the export. Allowed values: ["name", "channel_id", "creation_time", "last_modified_time", "creator_id", "description", "participant_count", "total_message_count", "status"]. Return a comma-separated list such as name,channel_id,participant_count when using $fromAI(). Use commas only. If the agent leaves this unset, the default export fields are name,channel_id,participant_count. Ask only for the minimum fields needed for the task.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('channel_fields', 'Channel fields to include in the export. Allowed values: ["name", "channel_id", "creation_time", "last_modified_time", "creator_id", "description", "participant_count", "total_message_count", "status"]. Return a comma-separated list such as name,channel_id,participant_count. Use commas only. If omitted, the default export fields are name,channel_id,participant_count. Ask only for the minimum fields needed for the task.', 'string', 'name,channel_id,participant_count').split(',').map(value => value.trim()).filter(Boolean) }}
```

---

### Next Token (Optional)

- Plain text description:
```txt
Optional. Opaque pagination cursor returned by a previous bulk export response as next_token. Reuse exactly as returned to fetch the next page. Blank values are allowed and omitted. For CSV export responses, Zoho may append it after three blank lines at the end of the csv text in the form next_token=....
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_token', 'Optional. Opaque pagination cursor returned by a previous bulk export response as next_token. Reuse exactly as returned to fetch the next page. Blank values are allowed and omitted. For CSV export responses, Zoho may append it after three blank lines at the end of the csv text in the form next_token=....', 'string', '') }}
```
