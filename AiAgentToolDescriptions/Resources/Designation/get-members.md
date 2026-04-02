# Designation: Get Designation Members

Use this guide to configure **Get Designation Members** for AI Agent Tool mode in n8n.

This operation lists the users currently associated with one designation in Zoho Cliq.

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
Get members for one designation in Zoho Cliq using a designation ID, an optional whole-number limit (defaults to 50), and an optional next_token. Use this when you need the current membership of a designation before or after add-members or remove-members operations. This is a read-only operation. Successful responses return a data array of user objects. A response may also include next_token for pagination. User objects commonly include id, zuid, zoid, name, display_name, email_id, and organization_id.

Example response:
{
  data: [
    {
      email_id: "micheller@zylker.com",
      zuid: "54218474",
      zoid: "54107592",
      display_name: "Michelle",
      name: "Michelle Rodrigues",
      organization_id: "631836344",
      id: "54218474"
    }
  ],
  next_token: "NEXT_PAGE_TOKEN"
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Designation (Required)

- Plain text description:
```txt
Required designation ID in Zoho Cliq. Use the exact canonical designation ID for the designation whose members you want to list.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('designation_id', 'Required designation ID in Zoho Cliq. Use the exact canonical designation ID for the designation whose members you want to list.', 'string') }}
```

---

### Limit (Optional)

- Plain text description:
```txt
Optional whole-number page size for designation members. The node sends a default limit of 50 when you do not override it.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('limit', 'Optional whole-number page size (limit). Use a whole number from 1 to 100.', 'number', 50) }}
```

---

### Next Token (Optional)

- Plain text description:
```txt
Optional next_token from a previous designation-members response. Use the exact token value to continue pagination. Blank values are allowed and omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('next_token', 'Optional next_token from a previous Zoho Cliq designation-members response. Use the exact token value to continue pagination. Blank values are allowed and omitted.', 'string', '') }}
```

### Scope Note

```txt
The local OpenAPI file marks limit as required for this endpoint. This node follows that contract by sending a default limit of 50 when you do not override the field.
```
