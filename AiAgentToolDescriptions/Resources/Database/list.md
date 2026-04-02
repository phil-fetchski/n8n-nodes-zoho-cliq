# Database: List Records

Use this guide to configure **List Records** for AI Agent Tool mode in n8n.

This operation lists records from a Zoho Cliq database with optional filtering and pagination inputs.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Leave **Additional Fields > Additional Query Parameters (JSON)** unused in AI Tool mode. Use the explicit Criteria, From Index, Limit, Order By, and Start Token fields instead.
- Do not delegate this setting to the agent.

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
List database records in Zoho Cliq using database_name plus optional criteria, pagination, and sorting inputs. 

This tool reads rows from an existing Cliq Database schema. 

Returned record field names come from the target database schema and are user-defined, so do not assume fixed column names beyond common fields such as id. 

Inspect the response and use the actual keys returned by this database. 

Cliq does not reliably return exact declared column types in list output, so downstream create/update steps may need to infer whether values are acting like text, longtext, boolean, number, or encrypted text from the returned values and workflow context. 

If structured object or array content needs to be stored later, plan to serialize it into a JSON string for a longtext column. 

Successful responses return a payload with a list array of matching records. Some responses may also include fields such as status or pagination metadata like next_token; treat those as additional fields around the list array.

An empty result is `list: []`, which is a valid no-match outcome and not an error.

If the database does not exist, or another request failure occurs and AI Error Mode or recoverable handling is enabled, the tool returns a structured error payload with `error: true` and a descriptive reason/message.

Compound criteria syntax such as AND/OR is not documented here. Prefer single-condition expressions only unless you have separately confirmed more complex criteria behavior for your target workspace.

Example Response:
{
  list: [
    {
      id: "14756000000008008",
      productid: "1004",
      productcategory: "zylker",
      instock: true
    },
    {
      id: "14756000000008003",
      productid: "1003",
      productcategory: "zylcal",
      instock: false
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

### Database Name (Required)

- Plain text description:
```txt
Required Zoho Cliq database unique name to list records from. Use the exact database unique name, not the display label.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('database_name', 'Required Zoho Cliq database unique name to list records from. Use the exact database unique name, not the display label.', 'string') }}
```

---

### Additional Fields > Criteria (Optional)

- Plain text description:
```txt
Optional criteria expression used to filter matching records. Example patterns: instock==true, productcategory==zylker, or productid==1001. Use real column names from the target database schema. You can only filter on a single criteria, compound criteria will cause errors. Leave blank to omit this filter. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('criteria', 'Optional criteria expression used to filter matching records. Example patterns: instock==true, productcategory==zylker, or productid==1001. Use real column names from the target database schema. You can only filter on a single criteria, compound criteria will cause errors. Leave blank to omit this filter. Blank values are allowed and omitted.', 'string', '') }}
```

---

### Additional Fields > From Index (Optional)

- Plain text description:
```txt
Optional whole-number starting index for offset-style pagination. Use 0 to start at the beginning. Use this when no next_token/start_token flow is available. Do not use from_index together with start_token.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('from_index', 'Optional whole-number starting index for offset-style pagination. Use 0 to start at the beginning. Use this when no next_token/start_token flow is available. Do not use from_index together with start_token.', 'number', 0) }}
```

---

### Additional Fields > Limit (Optional)

- Plain text description:
```txt
Optional whole-number page size. Valid range is 1 to 100.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('limit', 'Optional whole-number page size (limit). Use a whole number from 1 to 100.', 'number', 50) }}
```

---

### Additional Fields > Order By (Optional)

- Plain text description:
```txt
Optional sort expression. Use +column_name for ascending or -column_name for descending. Example: -created_at. Leave blank to omit. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('order_by', 'Optional sort expression. Use +column_name for ascending or -column_name for descending. Example: -created_at. Leave blank to omit. Blank values are allowed and omitted.', 'string', '') }}
```

---

### Additional Fields > Start Token (Optional)

- Plain text description:
```txt
Optional pagination token from a previous list response when Zoho Cliq returns next_token. Use start_token for the next immediate request after that response. Do not reuse an old token and do not combine start_token with from_index. Leave blank to omit. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('start_token', 'Optional pagination token from a previous list response when Zoho Cliq returns next_token. Use start_token for the next immediate request after that response. Do not reuse an old token and do not combine start_token with from_index. Leave blank to omit. Blank values are allowed and omitted.', 'string', '') }}
```

---

### Pagination Guidance

- Use `from_index` with `limit` for offset-style pagination when you are starting a query fresh.
- If a response includes `next_token`, pass that value into `start_token` on the next immediate request to continue the same result stream.
- Do not send both `from_index` and `start_token` in the same request.
