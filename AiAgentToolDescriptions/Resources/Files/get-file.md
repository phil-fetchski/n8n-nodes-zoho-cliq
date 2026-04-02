# Files: Get File

Use this guide to configure **Get File** for AI Agent Tool mode in n8n.

Use this operation to download one existing Zoho Cliq file by `fileId` and return file metadata plus binary output.

When you need to reuse the downloaded file in later tool calls, use `binary_handle_id`. Map it into Share Files as `binaryHandleId`. This keeps the file on the server side instead of pushing file bytes through the model context.

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
Use this tool to download one existing Zoho Cliq file by a known `fileId`. Call it only when you already have a stable `fileId`.

Get `fileId` from a previous Zoho Cliq message or file-sharing response. Use `Get_messages_in_Zoho_Cliq` to fetch messages with `type` set to `file`, then read the needed file ID from `data[index].content.file.id` in the matching message and pass that value as `fileId`.

Successful responses return top-level metadata fields `fileId`, `fileName`, `mimeType`, `fileSize`, `binaryProperty`, and `binary_handle_id` when n8n provides a reusable server-side binary handle. Use returned `binary_handle_id` as `binaryHandleId` in Share Files `file_entries_json_agent_choice` or `file_entries_json_explicit_target`.

The response also includes `binaryProperty` metadata for deterministic workflow use, but for tool chaining the focus is `binary_handle_id` -> `binaryHandleId`.

Validation or API failures return structured error context with `error`, `resource`, `operation`, and file details such as `file_id` and `binary_property`.

Example Response:
{
  fileId: "a_1234567890987654321_2_0123456789",
  fileName: "invoice.pdf",
  mimeType: "application/pdf",
  fileSize: 84219,
  binaryProperty: "data",
  binary_handle_id: "opaque-n8n-binary-handle"
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### File ID (Required)

- Plain text description:
```txt
Required Zoho Cliq file ID to download. Use the exact file ID returned by a previous message or file-sharing response. Do not invent, shorten, or normalize this value.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('file_id', 'Required Zoho Cliq file ID to download. Use the exact file ID returned by a previous message or file-sharing response. Do not invent, shorten, or normalize this value. Example file ID: `a_1234567890987654321_2_0123456789`', 'string') }}
```

---

### Output Data Field Name (Optional)

- Plain text description:
```txt
Optional output data field name for the downloaded file. Leave the default `data` unless a deterministic workflow specifically needs a different property name. For tool chaining, focus on the returned `binary_handle_id`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('output_data_field_name', 'Optional output data field name for the downloaded file. Leave the default data unless a deterministic workflow specifically needs a different property name. For tool chaining, focus on the returned binary_handle_id.', 'string', 'data') }}
```

---

### File Name (Optional)

- Plain text description:
```txt
Optional output file name override. Leave blank to use the API response headers or fall back to the file ID automatically. Blank values are allowed and treated as omitted.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('file_name', 'Optional output file name override. Leave blank to use the API response headers or fall back to the file ID automatically. Blank values are allowed and treated as omitted. Example file name: `invoice.pdf`', 'string', '') }}
```
