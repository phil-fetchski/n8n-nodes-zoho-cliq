# OAuth Helper: Get Granted Scopes

Use this guide to configure **Get Granted Scopes** for AI Tool mode in n8n.

Use this helper when an agent needs to inspect the scopes stored on the currently connected Zoho Cliq OAuth token and explain why another operation may or may not work.

## Important Note

- OAuth Helpers are not generally needed for agentic workflows and should usually be left out of an agent's tool set.
- In some cases, an agent may benefit from checking the scopes granted on the current token so it can reason about whether a later Zoho Cliq operation is likely to work or fail because required scopes are missing.
- These setup suggestions are provided for those diagnostic cases, but this helper should usually not be used in an agentic workflow.

- The suggested descriptions and expressions are reference examples, not a recommendation to expose every field to the agent in every workflow.
- Grant only the minimum access needed. This helper reveals credential scope metadata, which can help an agent reason about permissions, but it should still be exposed intentionally.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Set **Resource** to `OAuth Helper`.
- Set **Operation** to `Get Granted Scopes`.
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
Use this tool to inspect the scopes currently granted on the connected Zoho Cliq OAuth token. Use it when you need to explain why a later operation may fail, confirm whether a permission is present, or compare the current token against the node's supported scope catalog.

The tool reads the connected credentials and returns structured diagnostics including:
- `grantedScopesOnCurrentToken`
- `hasTokenScope`
- `hasRefreshToken`
- `counts.grantedOnCurrentToken`

If `include_all_supported_node_scopes` is enabled, the tool also returns:
- `allSupportedNodeScopes`
- `counts.allSupportedNodeScopes`

This tool does not call the Zoho Cliq REST API. It only inspects credential scope data already available to the node.
```

## Suggested Field Setup

### Include All Supported Node Scopes (Optional)

- Plain text description:
```txt
Optional boolean. Enable to include the full scope catalog supported by this node so the output can compare the current token against everything the node knows how to request.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('include_all_supported_node_scopes', 'Optional boolean. Enable to include the full scope catalog supported by this node so the output can compare the current token against everything the node knows how to request.', 'boolean', false) }}
```

## Output Notes

- `grantedScopesOnCurrentToken` is the most important field for follow-up reasoning.
- `allSupportedNodeScopes` is useful when the agent needs to compare the granted token against the node's broader capability surface.
- If no token scope is stored, the tool will return an empty granted-scope list and `hasTokenScope: false`.
