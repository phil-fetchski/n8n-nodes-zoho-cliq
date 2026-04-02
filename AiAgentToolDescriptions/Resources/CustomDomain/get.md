# Custom Domain: Get Custom Domain

Use this guide to configure **Get Custom Domain** for AI Agent Tool mode in n8n.

This operation retrieves the organization’s current custom domain details in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.

## Important Disclaimer

### No Agent-Controlled Inputs

This operation exposes no agent-controlled input fields, so there are no input examples, plain text descriptions, or `$fromAI()` expressions to configure. The agent triggers this operation as-is. You should still set the **Tool Description** below so the agent understands when and why to use this tool.

### Liability Notice

By configuring AI agent access to your Zoho Cliq account, **you accept full responsibility** for any changes the agent makes — including messages sent, channels created or deleted, users modified or removed, and any other account changes. The node developer accepts **zero liability** for any outcome resulting from agent actions on your account.

Test in a non-production environment first and **use a capable frontier model from a major lab**.

## Tool Description Suggestion

If you want to override n8n auto text for this tool, use top-level Tool Description:
- Open Tool Description
- Switch `Set Automatically` -> `Set Manually`
- Paste the suggestion below

```txt
Get the current custom domain for the Authenticated Zoho Cliq Account, if one is Configured. 

No additional Inputs/Parameters are required to call this Tool, just call it and receive the current Custom Domain configuration for the Authenticated Zoho Cliq Account/Instance.

Example response:
{
  "data":
  {
    "status": "active",
    "name": "chat.zylker.org",
    "ssl_enabled": true
  }
}

If no Custom Domain is currently configured, this tool can return:
{
  "url": "/api/v2/customdomain",
  "data": {},
  "success": true,
  "resource": "customDomain",
  "operation": "get",
  "configured": false,
  "message": "No Custom Domain is currently configured for the authenticated Zoho Cliq account."
}
```

## Suggested Field Setup

This operation has no agent-controlled input fields.
