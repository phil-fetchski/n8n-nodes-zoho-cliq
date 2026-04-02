# Events: Upload Event Attachment

Use this guide to configure **Upload Event Attachment** for AI Agent Tool mode in n8n.

This operation uploads one file to Zoho Cliq so its returned `attachments[].fileId` can be attached to an event later.

- This tool requires an actual incoming binary file from a previous node.
- In deterministic workflows, you can use a normal input data field name such as `data`.
- In agentic workflows, do not rely on the agent to provide a simple input data field name. Instead, map the file directly into this field with an n8n expression such as `{{ $('Read/Write Files from Disk').first().binary.data }}`.
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
Upload one file as an event attachment in Zoho Cliq and return a reusable `fileId`. Call this tool when a later Create Event or Update Event step needs an uploaded attachment. Use the returned `fileId` as an entry in the `attachment_ids` array for Create Event, or as the `id` value in an object inside the `attachments` array for Update Event. Do not generate extra parameters for this tool beyond calling it with the workflow-provided file input.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Input Data Field Name (User Setup Only)

Do not delegate this field to the agent with plain text AI descriptions or `$fromAI()`.

For deterministic workflows:

- Set the field to the input data field name directly, for example:
```txt
data
```

For agentic workflows:

- Map the file directly from the upstream node with an n8n expression, for example:
```txt
{{ $('Read/Write Files from Disk').first().binary.data }}
```

- Replace `Read/Write Files from Disk` with the actual node name that produced the binary file.
- If your upstream node stores the file under a different data field name, replace `.binary.data` with that property.
- Do not infer or generate this mapping dynamically. Configure it manually based on the node that provides the file.
