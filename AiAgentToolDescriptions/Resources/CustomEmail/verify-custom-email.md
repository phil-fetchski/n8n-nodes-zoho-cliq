# Custom Email: Verify Custom Email

Use this guide to configure **Verify Custom Email** for AI Agent Tool mode in n8n.

This operation retrieves the single organization-level Custom Email configuration and current verification state in Zoho Cliq.

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
Use this tool to read the current organization-level Custom Email configuration in Zoho Cliq. It returns the single account notification sender configuration and its current verification fields for the whole organization.

Use this tool before Update_mail_configuration_in_Zoho_Cliq whenever possible so you can work from the real current name, email_id, and cname_status values. This Custom Email configuration is account-level, not per-user, and only one Custom Email can exist at a time.

Example response:
{
  "data": {
    "email_id": "support@zylker.com",
    "name": "Zylker Corporation",
    "dkim_value": "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCr6KMgdxxgg7oT3ulMwPJs9RXgXDrI9UWU118pHEMohl3UbL3Jwp4oxp/9N3thh/3WCJnYV134zbEVolZwqaT3JsFEq/mQ/RpW/JnOZ3rnxqJPurb2bcfJol4SDxiWVObzHX31xnANzFcXnq1/5dMK5QvW4Jh7n0fm4+4ywqiy2QIDAQAB",
    "dkim_status": "verified",
    "dkim_host": "1522905413783._domainkey.zylker.com",
    "cname_status": "verified"
  }
}
```

## Suggested Field Setup

This operation has no agent-controlled input fields.

---

### Usage Note

- Use this tool when the agent needs to inspect the single account-level Custom Email configuration before deciding whether an update is necessary.
- Reuse its returned `name`, `email_id`, and `cname_status` values directly when chaining into **Update Mail Configuration**.
