# Custom Domain: Add Custom Domain

Use this guide to configure **Add Custom Domain** for AI Agent Tool mode in n8n.

This operation adds a new organization custom domain in Zoho Cliq.

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
Add one custom domain in Zoho Cliq using a fully qualified domain name such as chat.example.com. 

DNS Records for the Custom Domain must point to the relevant Cliq Datacenter and CNAME for Example: `cliq.cs.zohohost.com` (US Datacenter) - If you cannot verify that a domain has these active DNS records do NOT use this Tool.

If another custom domain is already configured, this tool can return a non-error skipped payload with skipped, reason, requestedName, and existingCustomDomain instead of sending the add request.

Example response:
{
  "data":
  {
    "status": "inactive",
    "name": "chat.zylker.org",
    "ssl_enabled": true
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

### Custom Domain (Required)

- Plain text description:
```txt
Required custom domain to add for the Zoho Cliq organization. Use a fully qualified domain name only, for example chat.example.com. Custom Domain DNS Records must be properly configured and propagated for the Custom Domain to have any effect - If you cannot verify that a domain has these active DNS records do NOT use this Tool. Do not pass a protocol, path, wildcard, or whitespace-only value.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('custom_domain_name', 'Required custom domain to add for the Zoho Cliq organization. Use a fully qualified domain name only, for example chat.example.com. Custom Domain DNS Records must be properly configured and propagated for the Custom Domain to have any effect - If you cannot verify that a domain has these active DNS records do NOT use this Tool. Do not pass a protocol, path, wildcard, or whitespace-only value.', 'string') }}
```

---

### Usage Note

- Remember that Zoho Cliq supports only one custom domain per organization. If one already exists, this tool returns a skipped response rather than replacing it.
