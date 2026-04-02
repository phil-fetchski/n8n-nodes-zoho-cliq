# Database: Get Record

Use this guide to configure **Get Record** for AI Agent Tool mode in n8n.

This operation retrieves one record from a Zoho Cliq database by record ID.

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
Get one database record in Zoho Cliq using database_name and record_id. This tool reads one row from an existing Cliq Database schema.

Returned record field names come from the target database schema and are user-defined, so do not assume fixed column names beyond common fields such as id.

Inspect the response and use the actual keys returned by this database.

It does not return reliable declared column-type metadata, so downstream create/update steps may need to infer whether values are acting like text, longtext, boolean, number, or encrypted text from the returned values and workflow context.

Successful responses wrap the returned record inside an `object` field, alongside top-level metadata such as `status` and `url`. The actual database columns are inside `object`, and those column names depend on the target database schema.

If the record is not found and AI Error Mode or recoverable handling is enabled, the tool returns a structured error payload with `error: true` and a descriptive reason/message instead of a record object.

If downstream logic expects a populated record but receives no `object` field, an empty `object`, or missing expected record fields inside `object`, treat that result as a failed lookup and verify the record ID and database name.

Example Response:
{
  status: "SUCCESS",
  url: "/api/v2/storages/orders/records/14756000888008001",
  object: {
    id: "14756000888008001",
    productid: "1001",
    productcategory: "zylker",
    instock: true,
    productdescription: "zylker description"
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

### Database Name (Required)

- Plain text description:
```txt
Required Zoho Cliq database unique name that contains the record to retrieve. Use the exact database unique name, not the display label.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('database_name', 'Required Zoho Cliq database unique name that contains the record to retrieve. Use the exact database unique name, not the display label.', 'string') }}
```

---

### Record ID (Required)

- Plain text description:
```txt
Required Zoho Cliq record ID to retrieve from this database. Use the exact record ID returned by a previous create, get, or list response. Record IDs are opaque Cliq values, often numeric strings such as 14756000888008001. Do not invent, normalize, or partially copy this value.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('record_id', 'Required Zoho Cliq record ID to retrieve from this database. Use the exact record ID returned by a previous create, get, or list response. Record IDs are opaque Cliq values, often numeric strings such as 14756000888008001. Do not invent, normalize, or partially copy this value.', 'string') }}
```
