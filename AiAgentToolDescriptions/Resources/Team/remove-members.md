# Team: Delete Team Members

Use this guide to configure **Delete Team Members** for AI Agent Tool mode in n8n.

This operation removes one or more users from one existing team in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- For **Team** plain-text Sparkles setup, switch the locator from `From List` to `By ID` before delegating the value.
- For **Team** `$fromAI()` setup, set the field to expression mode before pasting the expression.

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
Remove one or more users from an existing team in Zoho Cliq using an exact `team_id` plus a comma-separated `user_ids` string. Duplicate user IDs are deduplicated before requests are sent. Maximum 100 user IDs per request. This node is a convenience wrapper over repeated single-user delete calls to `DELETE /teams/{TEAM_ID}/members/{USER_ID}` and sends one delete request per user ID. Successful responses return `success`, `resource`, `operation`, `team_id`, `removed_user_ids`, `count`, `api_call_count`, `single_user_endpoint_used`, and any fields returned by Zoho Cliq. Recoverable partial-failure responses return `error`, `resource`, `operation`, `reason`, `team_id`, `user_ids`, `removed_user_ids`, `failed_user_ids`, `failure_count`, `partial_success`, and `failures`.

Example response:
{
  "success": true,
  "resource": "team",
  "operation": "removeMembers",
  "team_id": "53786870",
  "removed_user_ids": ["44344926", "54667722"],
  "count": 2,
  "api_call_count": 2,
  "single_user_endpoint_used": true
}

Example partial-failure response:
{
  "error": true,
  "resource": "team",
  "operation": "removeMembers",
  "reason": "REMOVE_TEAM_MEMBERS_FAILED",
  "team_id": "53786870",
  "user_ids": ["44344926", "54667722"],
  "removed_user_ids": ["44344926"],
  "failed_user_ids": ["54667722"],
  "failure_count": 1,
  "partial_success": true,
  "failures": [
    {
      "team_id": "53786870",
      "user_id": "54667722",
      "error": "User is not a member of the team"
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

### Team (Required)

- Plain text description:
```txt
Required canonical team ID in Zoho Cliq for the team whose members should be removed. Use the exact `team_id`. For example: `897444555`. Do not pass a team name here.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('team_id', 'Required canonical team ID in Zoho Cliq for the team whose members should be removed. Use the exact `team_id`. For example: `897444555`. Do not pass a team name here.', 'string') }}
```

---

### User IDs (Required)

- Plain text description:
```txt
Required comma-separated list of canonical Zoho Cliq user ID strings to remove from this team. Duplicate user IDs are deduplicated before requests are sent. Use user IDs only, not names or email addresses. For example: `987654321,987654322`. Maximum 100 user IDs per request.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('user_ids', 'Required comma-separated list of canonical Zoho Cliq user ID strings to remove from this team. Duplicate user IDs are deduplicated before requests are sent. Use user IDs only, not names or email addresses. For example: `987654321,987654322`. Maximum 100 user IDs per request.', 'string') }}
```
