# Custom Email: Update Mail Configuration

Use this guide to configure **Update Mail Configuration** for AI Agent Tool mode in n8n.

This operation updates the single organization-level Custom Email configuration used for account notification emails in Zoho Cliq.

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
Use this tool to update the single organization-level Custom Email configuration in Zoho Cliq for account notification emails. This is an account-level organization setting, not a per-user setting.

Treat all three inputs as mandatory real values: name, email_id, and cname_status. If Verify_custom_email_in_Zoho_Cliq is available, call it first and reuse its returned values unless you intentionally need to change them. If that tool is not available, only call this tool when you already know all three values from reliable context. Do not invent, guess, or fabricate any missing value.

Only one Custom Email can exist per Zoho Cliq organization at a time. Use this tool carefully because it changes the active organization notification sender configuration.

Important replacement behavior: if a different Custom Email is already configured, Zoho Cliq may return success but leave the entire existing Custom Email configuration unchanged. When that happens, this node appends a _warnings array with existing_email_id and requested_email_id plus guidance that a Cliq Administrator must remove the current Custom Email in the Cliq Admin Panel before a new one can be added.

Example response:
{
  "data": {
    "email_id": "support@zylker.com",
    "name": "Zylker Corporation",
    "dkim_value": "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCr6KMgdxxgg7oT3ulMwPJs9RXgXDrI9UWU118pHEMohl3UbL3Jwp4oxp/9N3thh/3WCJnYV134zbEVolZwqaT3JsFEq/mQ/RpW/JnOZ3rnxqJPurb2bcfJol4SDxiWVObzHX31xnANzFcXnq1/5dMK5QvW4Jh7n0fm4+4ywqiy2QIDAQAB",
    "dkim_status": "verified",
    "dkim_host": "1522905413783._domainkey.zylker.com",
    "cname_status": "verified"
  },
  "_warnings": [
    {
      "field": "custom_email_configuration",
      "reason": "Zoho Cliq accepted the update request but left the existing account-level Custom Email configuration unchanged because a Custom Email is already configured for this organization.",
      "action": "A Cliq Administrator must first remove the existing Custom Email in the Cliq Admin Panel. The API cannot replace an already-configured Custom Email, so none of the submitted fields are updated until the existing configuration is removed. Only one Custom Email can exist per organization at a time.",
      "existing_email_id": "current@zylker.com",
      "requested_email_id": "new@zylker.com"
    }
  ]
}
If the requested email_id matches the already-configured email_id, the response will contain only the data object without _warnings.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Name (Required)

- Plain text description:
```txt
Required account-level custom sender display name for Zoho Cliq organization notification emails. If Verify_custom_email_in_Zoho_Cliq is available, call it first and reuse the returned name unless you intentionally need to change it. Do not fabricate or assume this value. Use a concise human-readable sender name representative of the organization. Maximum length: 120 characters.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('name', 'Required account-level custom sender display name for Zoho Cliq organization notification emails. If Verify_custom_email_in_Zoho_Cliq is available, call it first and reuse the returned name unless you intentionally need to change it. Do not fabricate or assume this value. Use a concise human-readable sender name representative of the organization. Maximum length: 120 characters.', 'string') }}
```

---

### Email ID (Required)

- Plain text description:
```txt
Required account-level sender email address for outgoing Zoho Cliq organization notification emails. If Verify_custom_email_in_Zoho_Cliq is available, call it first and reuse the returned email_id unless you intentionally need to change it. Do not fabricate or assume this value. Use a valid email address such as support@example.com. This maps directly to the verify output field email_id. Important: if a different Custom Email is already configured, Zoho Cliq may return success while leaving the current Custom Email configuration unchanged, and the node will return a warning explaining that a Cliq Administrator must remove the current Custom Email in the Cliq Admin Panel before any submitted fields can be updated.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('email_id', 'Required account-level sender email address for outgoing Zoho Cliq organization notification emails. If Verify_custom_email_in_Zoho_Cliq is available, call it first and reuse the returned email_id unless you intentionally need to change it. Do not fabricate or assume this value. Use a valid email address such as support@example.com. This maps directly to the verify output field email_id. Important: if a different Custom Email is already configured, Zoho Cliq may return success while leaving the current Custom Email configuration unchanged, and the node will return a warning explaining that a Cliq Administrator must remove the current Custom Email in the Cliq Admin Panel before any submitted fields can be updated.', 'string') }}
```

---

### CNAME Status (Required)

- Plain text description:
```txt
Required DNS verification state for the single organization-level Custom Email configuration. If Verify_custom_email_in_Zoho_Cliq is available, call it first and reuse the returned cname_status unless you intentionally need to change it. Do not fabricate or assume this value. This maps directly to the verify output field cname_status. ENUM: ["verified", "not_verified"]. Use verified only after the required DNS CNAME record is confirmed. Use not_verified when the DNS setup is not complete yet.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('cname_status', 'Required DNS verification state for the single organization-level Custom Email configuration. If Verify_custom_email_in_Zoho_Cliq is available, call it first and reuse the returned cname_status unless you intentionally need to change it. Do not fabricate or assume this value. This maps directly to the verify output field cname_status. ENUM: ["verified", "not_verified"]. Use verified only after the required DNS CNAME record is confirmed. Use not_verified when the DNS setup is not complete yet.', 'string') }}
```

---

### Usage Note

- Treat this tool as an account-level organization setting change, not a per-user setting.
- Prefer calling **Verify Custom Email** first so the agent can work from real current values instead of guessed ones.
- Configure only the fields the agent truly needs to control. Do not enable every suggested field at once.
