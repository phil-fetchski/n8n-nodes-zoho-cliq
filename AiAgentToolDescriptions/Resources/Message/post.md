# Message: Post Message

Use this guide to configure **Post Message** for AI Tool mode in n8n.

Use this operation to send one plain-text message or one raw JSON message object in Zoho Cliq to a channel, bot, chat, thread, or direct user target.

Use **Get Messages** or **Retrieve Message** to obtain an existing message identifier before populating **Reply To Message ID**. Enable **Sync Message** whenever the workflow needs `message_id` or other returned message metadata for chaining. Without **Sync Message**, many target families can return sparse or empty responses by default.

When a reply creates or continues a thread, the response can also include `thread_information.parent_message_id`, the original composite `thread_information.chat_id`, and ready-to-reuse `thread_information.thread_chat_id` plus `thread_information.thread_id` for follow-up thread target calls.

## Manual Tool Settings

Set these manually before choosing one of the setup paths below:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Choose exactly one setup path from this guide. Do not mix the two paths in the same tool.
- This guide supports two message type setups: `Text (Cliq Markdown)` for normal plain-text messages, or `Advanced (JSON)` for raw JSON message objects used mainly for card payloads.
- Do not use `Rich/Card` for AI Tool setup in this operation.
- Set **Message Type** manually to either `Text (Cliq Markdown)` or `Advanced (JSON)`. Do not delegate this choice to the agent — the n8n UI shows only the matching content field based on your selection.
- Keep **Include Enhanced Output** enabled when channel-target posts should also return `posted_to_channel.channel_id`, `posted_to_channel.chat_id`, `posted_to_channel.unique_name`, and `posted_to_channel.level` for follow-up Message tools.
- If **Message Type** is set to `Text (Cliq Markdown)`, configure only the **Text** field for the agent.
- If **Message Type** is set to `Advanced (JSON)`, configure only the **JSON** field for the agent.
- Do not delegate **Target** to the agent.

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

This operation supports multiple destination types (channels, bots, chats, threads, and direct users). Before configuring the tool's inputs, you need to decide **who controls where messages go** — you or the agent. This is the single most important decision for this tool, and it cannot be changed without reconfiguring the tool from scratch.

### [Path 1: You Choose the Target](post-path1-user-chooses.md)

**Best for:** Workflows where the destination is known at build time — e.g., "post status updates to #engineering" or "send alerts to the ops chat."

In this path, you manually set **Target** to a specific destination type (Channel, Bot, Chat, Thread, or User) during setup. The agent can compose the message and fill in identifiers, but it can **only** post to the target type you selected. It cannot redirect messages to a different destination type at runtime.

**Choose this path when:**
- Your workflow always posts to the same type of destination
- You want to limit the agent's access to a single target family for security or simplicity
- The destination is deterministic and doesn't need to change per run

### [Path 2: The Agent Chooses the Target](post-path2-agents-choice.md)

**Best for:** Workflows where the agent needs to dynamically route messages — e.g., "notify the right person or channel based on the situation."

In this path, you set **Target** to `Agent's Choice` and configure all target identifier fields so they appear in the tool schema. The agent then selects the destination family (`channelId`, `channelUniqueName`, `bot`, `chat`, `thread`, or `user`) and provides the matching identifier on each tool call.

**Choose this path when:**
- The agent needs to decide where to post based on context or prior tool results
- Your workflow routes messages to different destination types depending on the situation
- You are comfortable granting the agent broader access across your Cliq account

**Important:** Do not mix the two paths in the same tool. Pick one, follow its dedicated setup guide, and configure only that path's fields.
