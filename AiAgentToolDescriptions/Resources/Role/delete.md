# Role: Delete Role

Use this guide to configure **Delete Role** for AI Agent Tool mode in n8n.

This operation deletes one role in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.

## Runtime Note

- The local `Docs/cliq-openapi-all/roles.yml` file lists `ZohoCliq.Organisation.DELETE` for deleting a role.
- The public Zoho Cliq REST docs for **Delete Role** show `ZohoCliq.Organisation.UPDATE`.
- The node accepts either `ZohoCliq.Organisation.UPDATE` or `ZohoCliq.Organisation.DELETE` for this operation so both documented interpretations continue to work.

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
Delete one role in Zoho Cliq using a canonical role ID. Use this only when the role should be removed entirely. This operation is destructive and is not reversible. Default Roles in Zoho Cliq (Admin, Member) cannot be Deleted, only custom Roles can be deleted with this tool. The Get Role or List Roles Tools, if available, will include `data[].is_default` boolean for each role that you can reference if you are unsure whether the Role in question can, or should, be deleted. When you delete a custom role that has Users currently assigned to it, those Users will automatically be assigned to the Default `Members` Role in Cliq, and may need to be reassigned to a new Role in a following step. Do Not Assign any User to the Default `Admin` Role in Cliq without a Direct Request from your User, which you should Confirm. 

By default this node returns enhanced success output for the sparse delete response:
{
  "success": true,
  "resource": "role",
  "operation": "delete",
  "role_id": "42405000000224001"
}
Reuse role_id for confirmation, audit logging, or downstream cleanup logic.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Role (Required)

- Plain text description:
```txt
Required canonical role ID in Zoho Cliq. Use the exact role ID you want to delete, for example 42405000000224001.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('role_id', 'Required canonical role ID in Zoho Cliq. Use the exact role ID you want to delete, for example 42405000000224001.', 'string') }}
```
