# Chat: Get Chat Members

Use this guide to configure **Get Chat Members** for AI Agent Tool mode in n8n.

This operation retrieves the members currently present in one Zoho Cliq chat.

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
Get the current member list for one chat in Zoho Cliq using chat_id. Returns an object with a members array. The fields parameter controls requested user fields from user_id, email_id, and name when they are available for that member type. Bot members may also include bot_unique_name and store_app_id, and bot members may not include email_id. If a bot member has store_app_id = -1, that bot is not a marketplace custom bot and app_key-based access is not needed. If store_app_id is a real app ID value, some bot and message operations may require that bot's app_key to access it successfully. Use chat_id only here, not channel_id. Chat IDs are not limited to one format: some are all-numeric and some use a CT_ style.

For example:
{
  members: [
    {
      user_id: "431930546",
      email_id: "olivia.palmer@zylcal.com",
      name: "Olivia - Content Writer"
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

### Chat ID (Required)

- Plain text description:
```txt
Required Zoho Cliq chat ID for the chat whose members should be retrieved. This is not a channel_id. Chat IDs are not limited to one format: some are all-numeric and some use a CT_ style. Do not pass a channel ID, channel unique name, or display name.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('chat_id', 'Required Zoho Cliq chat ID for the chat whose members should be retrieved. This is not a channel_id. Chat IDs are not limited to one format: some are all-numeric and some use a CT_ style. Do not pass a channel ID, channel unique name, or display name.', 'string') }}
```

---

### Fields in Response (Optional)

- Plain text description:
```txt
Optional member fields to include in the response. Allowed values: ["name", "email_id", "user_id"]. Return a comma-separated list such as name,email_id when using $fromAI(). Use commas only, with no spaces between values. Bot members may not include email_id even when requested. Bot response entries may also include bot_unique_name and store_app_id. If store_app_id = -1, the bot is not a marketplace custom bot and app_key-based access is not needed. If store_app_id is a real app ID value, some bot and message operations may require that bot's app_key. Leave the default values in place to return all supported fields.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('fields', 'Optional member fields to include in the response. Allowed values: ["name", "email_id", "user_id"]. Return a comma-separated list such as name,email_id. Use commas only, with no spaces between values. Bot members may not include email_id even when requested. Bot response entries may also include bot_unique_name and store_app_id. If store_app_id = -1, the bot is not a marketplace custom bot and app_key-based access is not needed. If store_app_id is a real app ID value, some bot and message operations may require that bot\'s app_key. Leave the default values in place to return all supported fields.', 'string', 'name,email_id,user_id').split(',').map(value => value.trim()).filter(Boolean) }}
```
