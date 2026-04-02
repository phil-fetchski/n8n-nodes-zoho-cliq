# User Status: Delete Temporary Status

Use this guide to configure **Delete Transient Status** for AI Agent Tool mode in n8n.

This operation clears the authenticated user's temporary status in Zoho Cliq.

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
Delete the authenticated user's temporary status in Zoho Cliq. This clears only the current temporary or ephemeral status and does not delete reusable saved statuses. Successful responses return `success`, `resource`, `operation`, `target`, `cleared`, and `data`. `target` is always `current_transient_status`. `data` is an empty string for this sparse success response. Use this when a temporary status should end before its `expiry`.

Example response:
{
  "success": true,
  "resource": "userStatus",
  "operation": "clearMyStatus",
  "target": "current_transient_status",
  "cleared": true,
  "data": ""
}
```

## Suggested Field Setup

This operation has no agent-controlled input fields.
