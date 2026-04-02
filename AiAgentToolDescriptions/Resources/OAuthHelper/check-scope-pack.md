# OAuth Helper: Check Scope Pack

Use this guide to configure **Check Scope Pack** for AI Tool mode in n8n.

Use this helper when an agent already knows which capability pack matters and needs a direct answer about whether the current token satisfies it.

## Important Note

- OAuth Helpers are not generally needed for agentic workflows and should usually be left out of an agent's tool set.
- In some cases, an agent may benefit from checking the scopes granted on the current token so it can reason about whether a later Zoho Cliq operation is likely to work or fail because required scopes are missing.
- These setup suggestions are provided for those diagnostic cases, but this helper should usually not be used in an agentic workflow.

- This guide is a reference example. Only expose this helper when permission diagnostics are useful in the workflow.
- The available packs come from the node's credential constants, not from a live Zoho Cliq API call.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Set **Resource** to `OAuth Helper`.
- Set **Operation** to `Check Scope Pack`.
- Do not delegate **Resource** or **Operation** to the agent.

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
Use this tool to check whether the scopes currently granted on the connected Zoho Cliq token satisfy one named scope pack.

Input:
- `packName`: one scope pack key from the node-defined catalog. Valid ENUM values: ["coreMessaging", "corePeopleProfile", "coreTeamsOrgStructure", "eventsCalendar", "remindersTasks", "filesStorage", "orgAdmin", "remoteWorkZohoPeople", "botAndWebhooks"].

Scope pack key reference:
- `coreMessaging` = Core Messaging
- `corePeopleProfile` = Core People & Profile
- `coreTeamsOrgStructure` = Core Teams & Org Structure
- `eventsCalendar` = Events & Calendar
- `remindersTasks` = Reminders & Tasks
- `filesStorage` = Files & Storage
- `orgAdmin` = Org Admin (Organization APIs)
- `remoteWorkZohoPeople` = Remote Work + Zoho People
- `botAndWebhooks` = Bot & Webhooks

The tool returns:
- `packName`
- `packDisplayName`
- `packScopes`
- `hasAllRequiredScopes`
- `missingScopes`

Use this tool when you already know the relevant capability area and want a quick yes/no answer plus the exact missing scopes that block it.
```

## Suggested Field Setup

### Pack Name

- In AI Tool mode, switch **Pack Name** to expression mode if you want the agent to choose the scope pack dynamically.
- Plain text description:
```txt
Return one scope pack key string to compare against the currently granted token scopes. Valid ENUM values: ["coreMessaging", "corePeopleProfile", "coreTeamsOrgStructure", "eventsCalendar", "remindersTasks", "filesStorage", "orgAdmin", "remoteWorkZohoPeople", "botAndWebhooks"]. Use the key, not the human label. The output reports whether the full pack is satisfied and lists any missing scopes.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('pack_name', 'Return one scope pack key string to compare against the currently granted token scopes. Valid ENUM values: [\"coreMessaging\", \"corePeopleProfile\", \"coreTeamsOrgStructure\", \"eventsCalendar\", \"remindersTasks\", \"filesStorage\", \"orgAdmin\", \"remoteWorkZohoPeople\", \"botAndWebhooks\"]. Use the key, not the human label. Human label reference: coreMessaging = Core Messaging; corePeopleProfile = Core People & Profile; coreTeamsOrgStructure = Core Teams & Org Structure; eventsCalendar = Events & Calendar; remindersTasks = Reminders & Tasks; filesStorage = Files & Storage; orgAdmin = Org Admin (Organization APIs); remoteWorkZohoPeople = Remote Work + Zoho People; botAndWebhooks = Bot & Webhooks.', 'string') }}
```

## Output Notes

- `hasAllRequiredScopes` is the quickest decision field.
- `missingScopes` is the most useful field for follow-up remediation guidance.
- If the selected pack is unknown, the tool will return a structured validation error that also includes the acceptable scope pack key values.
