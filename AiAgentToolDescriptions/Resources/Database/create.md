# Database: Create Record

Use this guide to configure **Create Record** for AI Agent Tool mode in n8n.

This operation creates one record in a Zoho Cliq database.

- Set **Input Mode** to `Using JSON`.
- Use `Record Values (JSON)` for agent-controlled input.
- Do not use **Record Values** resource-mapper mode unless a human is configuring the mapped fields manually.
## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
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
Create one database record in Zoho Cliq using a database unique name and a record-values JSON object. This tool only writes rows into an existing Cliq Database schema. It does not create databases, tables, columns, or schema metadata. Match each supplied value to the existing column type already defined in Cliq. Known Cliq Database column types are text, longtext, boolean, number, and encrypted text. If object or array content must be stored, serialize it into a JSON string for a longtext column. Returns the created record object, typically including id plus the stored database columns. Additional record fields may be present depending on the target database schema.

For example:
{
  id: "14756000888008001",
  productid: "1001",
  productcategory: "zylker",
  instock: true,
  productdescription: "zylker description"
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
Required Zoho Cliq database unique name where the new record should be created. Use the exact database unique name, not the display label.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('database_name', 'Required Zoho Cliq database unique name where the new record should be created. Use the exact database unique name, not the display label.', 'string') }}
```

---

### Record Values (JSON) (Required When Input Mode = Using JSON)

- Plain text description:
```txt
Required top-level JSON object of database field values to create. Pass field values as a JSON-encoded string or a native JSON object. The object must contain at least one field. Use real column names from this Zoho Cliq database only. Match each value to the existing column type expected by the database. Known Cliq Database column types are text, longtext, boolean, number, and encrypted text. If object or array content must be stored, serialize it into a JSON string for a longtext column. Unsafe object keys such as __proto__, constructor, and prototype are rejected.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('record_values', 'Required top-level JSON object of Zoho Cliq database field values to create. Use real column names from this Zoho Cliq database only. The object must contain at least one field. Match each value to the existing column type expected by the database. Known Cliq Database column types are text, longtext, boolean, number, and encrypted text. If object or array content must be stored, serialize it into a JSON string for a longtext column. Pass field values as a JSON-encoded string or a native JSON object.', 'string') }}
```
