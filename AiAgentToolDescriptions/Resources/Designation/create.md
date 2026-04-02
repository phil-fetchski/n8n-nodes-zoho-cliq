# Designation: Create Designation

Use this guide to configure **Create Designation** for AI Agent Tool mode in n8n.

This operation creates one designation in Zoho Cliq.

- Set **Input Mode** to `Using JSON`.
- Use `Designation Definition (JSON)` for agent-controlled input, not the structured `Name` and `User IDs` fields.
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
Create one designation in Zoho Cliq using a JSON request body. Use this when the designation does not exist yet. The request body must be a non-empty JSON object containing a required name string and may include an optional user_ids array of canonical Zoho Cliq user ID strings for the initial members. Important: each user can hold only one designation at a time, so assigning user_ids here automatically removes those users from their previous designation. Do not send any keys other than name and optional user_ids. Successful responses return a data object that typically includes the created designation id and name.

For example:
{
  data: {
    id: "1901318000002280003",
    name: "Marketing Executive"
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

### Designation Definition (JSON) (Required When Input Mode = Using JSON)

- Plain text description:
```txt
Required non-empty top-level JSON object for a Zoho Cliq designation create request. Pass either a JSON-encoded string or a native JSON object. Allowed top-level keys are exactly name and optional user_ids. name is required, must be a non-empty string, and must be 30 characters or fewer. user_ids is optional, but when included it must be an array of one or more canonical Zoho Cliq user ID strings. Do not send user_ids as a comma-separated string in Using JSON mode. Omit user_ids entirely when there are no initial members to assign. Important: each user can hold only one designation at a time, so assigning user_ids here automatically removes those users from their previous designation. Do not send any other keys. Use this exact payload shape:
{
  "name": "Marketing Executive",
  "user_ids": [
    "987654321",
    "987654322"
  ]
}
Unsafe object keys such as __proto__, constructor, and prototype are rejected.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('designation_definition', 'Required non-empty top-level JSON object for a Zoho Cliq designation create request. Allowed top-level keys are exactly name and optional user_ids. name is required, must be a non-empty string, and must be 30 characters or fewer. user_ids is optional, but when included it must be an array of one or more canonical Zoho Cliq user ID strings. Do not send user_ids as a comma-separated string in Using JSON mode. Omit user_ids entirely when there are no initial members to assign. Important: each user can hold only one designation at a time, so assigning user_ids here automatically removes those users from their previous designation. Do not send any other keys. Pass either a JSON-encoded string or a native JSON object. Use this exact payload shape: {\"name\":\"Marketing Executive\",\"user_ids\":[\"987654321\",\"987654322\"]}', 'string') }}
```
