# Files: Share Files

Use this guide to configure **Share Files** for AI Agent Tool mode in n8n.

Use this operation to share one or more existing files to a Zoho Cliq chat, channel, bot, or direct user target.

**Get File** returns `binary_handle_id`; when chaining tools, map that value into each file entry's `binaryHandleId` field. Build file entries with `binaryHandleId`.

## Manual Tool Settings

Set these manually before choosing one of the setup paths below:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Choose exactly one setup path from this guide. Do not mix the two paths in the same tool.
- Set **File Input Mode** to `Using JSON`.
- Use **File Entries (JSON)** for agent-controlled input, not the structured **File Entries** field.
- Do not delegate **Share Target** or **File Input Mode** to the agent.

## Important Disclaimer

### Every Input Has an Example — Use Only What You Need

This guide provides a description and `$fromAI()` expression for **every** input so you have a ready-made starting point for each one. This is **not** a recommendation to enable them all on any given tool. Every workflow is different — give your agent control over only the inputs it genuinely needs to decide.

- **Hardcode what doesn't change.** If a value is the same every run (e.g., always posting to the same channel), hardcode it or use a standard n8n expression. There is no reason for the agent to provide what it doesn't need to decide.
- **Every token costs money.** Each `$fromAI()` field adds tokens to every agent invocation. More fields mean higher cost per run — configure deliberately.
- **Security surface.** Each agent-controlled field is a runtime decision you are delegating to a model. The more you delegate, the larger the blast radius if intent is misinterpreted. Grant only the minimum access your workflow requires.

### Liability Notice

By configuring AI agent access to your Zoho Cliq account, **you accept full responsibility** for any changes the agent makes — including messages sent, channels created or deleted, users modified or removed, and any other account changes. The node developer accepts **zero liability** for any outcome resulting from agent actions on your account.

Test in a non-production environment first and **use a capable frontier model from a major lab**.

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Choose a Setup Path

This operation shares files to chats, channels, bots, or direct users. Before configuring the tool's inputs, you need to decide **who controls where files are shared** — you or the agent.

### [Path 1: You Choose the Share Target](share-files-path1-user-chooses.md)

**Best for:** Workflows where the file destination is known at build time — e.g., "share reports to #finance" or "send exports to the team chat."

In this path, you manually set **Share Target** to a specific destination type (Chat, Channel By ID, Channel By Unique Name, Bot, or User) during setup. The agent provides the file entries and optional settings, but it can **only** share files to the target type you selected. It cannot redirect files to a different destination type at runtime.

**Choose this path when:**
- Your workflow always shares files to the same type of destination
- You want to limit the agent's file-sharing access to a single target family
- The destination is deterministic and doesn't change per run

### [Path 2: The Agent Chooses the Share Target](share-files-path2-agents-choice.md)

**Best for:** Workflows where the agent needs to dynamically route file shares — e.g., "send the downloaded file to whichever conversation requested it."

In this path, you set **Share Target** to `Agent's Choice` and configure all target identifier fields so they appear in the tool schema. The agent then selects the destination family (`chat`, `channelId`, `channelUniqueName`, `bot`, or `buddy`) and provides the matching identifier on each tool call.

**Choose this path when:**
- The agent needs to decide where to share files based on context or prior tool results
- Your workflow routes files to different destination types depending on the situation
- You are comfortable granting the agent broader file-sharing access across your Cliq account

**Important:** Do not mix the two paths in the same tool. Pick one, follow its dedicated setup guide, and configure only that path's fields.
