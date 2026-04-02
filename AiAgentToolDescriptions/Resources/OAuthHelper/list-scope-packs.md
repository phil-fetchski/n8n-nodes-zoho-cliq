# OAuth Helper: List Scope Packs

Use this guide to configure **List Scope Packs** for AI Tool mode in n8n.

Use this helper when an agent needs to see the named scope-pack catalog used by the node and compare those packs against the scopes currently granted on the connected token.

## Important Note

- OAuth Helpers are not generally needed for agentic workflows and should usually be left out of an agent's tool set.
- In some cases, an agent may benefit from checking the scopes granted on the current token so it can reason about whether a later Zoho Cliq operation is likely to work or fail because required scopes are missing.
- These setup suggestions are provided for those diagnostic cases, but this helper should usually not be used in an agentic workflow.

- This guide is a reference example. Only expose this helper when it is genuinely useful for permission diagnostics or setup assistance.
- The output describes node-defined scope packs, not a live API response from Zoho Cliq.

- Set **Resource** to `OAuth Helper`.
- Set **Operation** to `List Scope Packs`.
## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Do not delegate **Resource** or **Operation** to the agent.

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
Use this tool to list the Zoho Cliq scope packs defined by this node and compare each pack against the scopes currently granted on the connected token.

The tool returns:
- `totalPacks`
- `packs`

Each pack entry includes:
- `packName`
- `displayName`
- `description`
- `scopes`
- `scopeCount`
- `hasAllRequiredScopes`
- `missingScopes`
- `grantedScopeCount`

Use this tool when you need to map a capability area such as messaging, files, org admin, or reminders to the scopes it requires, or when deciding which pack to check next with Check Scope Pack.
```

## Output Notes

- `packs[].hasAllRequiredScopes` quickly shows which capability areas the current token can already satisfy.
- `packs[].missingScopes` is useful for agent explanations and remediation suggestions.
- This helper has no required user input beyond selecting the operation itself.
