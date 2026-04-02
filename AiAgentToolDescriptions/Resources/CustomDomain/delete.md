# Custom Domain: Delete Custom Domain

Use this guide to configure **Delete Custom Domain** for AI Agent Tool mode in n8n.

This operation deletes the organization’s current custom domain in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.

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
Delete the current custom domain in Zoho Cliq. By default this tool returns enhanced success metadata with success, resource, operation, target, and the sparse runtime response field `data` with an empty string value.

No Additional Inputs need to be passed when calling this Tool, Cliq will simply remove the currently configured Custom Domain for this Account's Cliq Instance, if a Custom Domain exists.

Example response:
{
  "success": true,
  "resource": "customDomain",
  "operation": "delete",
  "target": "current_custom_domain",
  "data": ""
}
```

## Suggested Field Setup

This operation has no agent-controlled input fields.
