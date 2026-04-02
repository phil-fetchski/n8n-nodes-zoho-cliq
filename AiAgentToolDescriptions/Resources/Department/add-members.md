# Department: Add Department Members

Use this guide to configure **Add Department Members** for AI Agent Tool mode in n8n.

This operation adds one or more members to an existing department in Zoho Cliq.

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
Add one or more members to a department in Zoho Cliq using department_id plus one member_identifiers array. Return either a JSON array of canonical user ID strings or a JSON array of email ID strings, never both in the same request. Example user_ids array: ["631830849","636000786"]. Example email_ids array: ["amelia.b@zylker.com","scott.fisher@zylker.com"]. By default this tool returns enhanced success metadata with success, resource, operation, department_id, identifier_type, member_identifiers, added_count, and the sparse runtime response field data. Reuse department_id and member_identifiers if you need to verify membership or remove the same users later.

For example:
{
  "success": true,
  "resource": "department",
  "operation": "addMembers",
  "department_id": "1901318000001071015",
  "identifier_type": "email_ids",
  "member_identifiers": ["amelia.b@zylker.com", "scott.fisher@zylker.com"],
  "added_count": 2,
  "data": ""
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Department (Required)

- Plain text description:
```txt
Required department_id in Zoho Cliq where members should be added. Use the exact department ID string, not a department name. Example: 1901318000001071015.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('department_id', 'Required department ID in Zoho Cliq where members should be added. Use the exact department ID string, not a department name. Example: 1901318000001071015.', 'string') }}
```

---

### Member Identifiers (Required)

- Plain text description:
```txt
Required member_identifiers array for the department-members add request. Return either a JSON array of canonical Zoho Cliq user ID strings or a JSON array of email ID strings. Use one identifier type only per request; mixed identifier types are rejected. Example user_ids array: ["631830849","636000786"]. Example email_ids array: ["amelia.b@zylker.com","scott.fisher@zylker.com"]. Maximum 100 identifiers per request.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('member_identifiers', 'Required member_identifiers array for the department-members add request. Return either a JSON array of canonical Zoho Cliq user ID strings or a JSON array of email ID strings. Use one identifier type only per request; mixed identifier types are rejected. Example user_ids array: [\"631830849\",\"636000786\"]. Example email_ids array: [\"amelia.b@zylker.com\",\"scott.fisher@zylker.com\"]. Maximum 100 identifiers per request.', 'string') }}
```
