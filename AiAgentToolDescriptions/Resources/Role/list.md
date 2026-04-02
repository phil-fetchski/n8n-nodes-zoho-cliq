# Role: List Roles

Use this guide to configure **List Roles** for AI Agent Tool mode in n8n.

This operation lists roles in Zoho Cliq for the authenticated organization admin account.

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
List roles in Zoho Cliq for the authenticated organization. Use this when you need to discover canonical role IDs before calling Get Role, Update Role, Delete Role, Get Users In Role, or Get Role Permissions. Successful responses return a data array of role summaries. Each role object commonly includes data[].id, data[].name, data[].profile_type, data[].is_default, and data[].description when available.

Example response:
{
  "data": [
    {
      "is_custom_admin": false,
      "id": "42405000000004047",
      "name": "Admin",
      "profile_type": "Admin",
      "creation_time": "2020-08-10T12:27:35+05:30",
      "last_modified_time": "2020-08-10T12:27:35+05:30",
      "organization_id": "62914174",
      "is_default": true
    },
    {
      "is_custom_admin": false,
      "id": "42405000000004049",
      "name": "Members",
      "profile_type": "Members",
      "creation_time": "2020-08-10T12:27:35+05:30",
      "last_modified_time": "2020-08-10T12:27:35+05:30",
      "organization_id": "62914174",
      "is_default": true
    },
    {
      "is_custom_admin": false,
      "id": "42405000000189003",
      "name": "Test Member",
      "profile_type": "Members",
      "creation_time": "2022-02-17T15:37:39+05:30",
      "last_modified_time": "2022-02-17T15:37:39+05:30",
      "organization_id": "62914174",
      "is_default": false,
      "description": "123"
    }
  ]
}
```

## Suggested Field Setup

This operation has no agent-controlled input fields.
