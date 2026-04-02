# Thread: Create Thread

Use this guide to configure **Create Thread** for AI Tool mode in n8n.

Use this operation to create one new Zoho Cliq thread from one existing parent message in a channel or chat and send the first message inside that new thread.

Use **Get Messages**, **Retrieve Message**, or another upstream message-discovery step to obtain the parent message identifier before populating **Thread Message ID**. Enable **Sync Message** whenever the workflow needs `message_id` or other returned message metadata for chaining.

Use **Retrieve Message**, **Get Messages**, or **List Threads** after creation when the workflow needs the created thread conversation identifiers for follow-up Thread tools.

## Manual Tool Settings

Set these manually before choosing one of the setup paths below:
- Choose exactly one setup path from this guide. Do not mix the two paths in the same tool.
- This guide supports two AI-controlled payload paths only: `text` for normal plain-text thread messages, or `json` for raw JSON message objects used mainly for card payloads.
- Do not use `rich` / `Rich/Card` for AI Tool setup in this operation.
- Decide upfront whether **Message Type** will be fixed by the user or chosen by the agent.
- If **Message Type** is fixed to `text`, make **Text** the only agent-controlled content input and leave **JSON** blank.
- If **Message Type** is fixed to `json`, make **JSON** the only agent-controlled content input and leave **Text** blank.
- If **Message Type** is AI-controlled with `$fromAI()`, configure both **Text** and **JSON** with the optional expression variants from this guide so the agent can populate only the field that matches the selected message type.
- If **ZohoCliq.Chats.READ** is also granted, recoverable-mode chat-target calls can use the shared chat preflight for more precise invalid-chat guidance. Without that extra read scope, the operation still runs and the normal API path handles chat-target failures.
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
- Do not delegate **Target** or **Message Type** to the agent.

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

This operation creates threads in channels or chats. Before configuring the tool's inputs, you need to decide **who controls where threads are created** — you or the agent.

### [Path 1: You Choose the Target](create-path1-user-chooses.md)

**Best for:** Workflows where the thread location is known at build time — e.g., "create threads in #support-tickets" or "start threads in the team chat."

In this path, you manually set **Target** to a specific destination type (Channel, Channel By Unique Name, or Chat) during setup. The agent provides the parent message ID and thread content, but it can **only** create threads in the target type you selected. It cannot switch to a different target type at runtime.

**Choose this path when:**
- Your workflow always creates threads in the same type of conversation
- You want to restrict the agent to a single target family for security or simplicity
- The target conversation type is deterministic and doesn't change per run

### [Path 2: The Agent Chooses the Target](create-path2-agents-choice.md)

**Best for:** Workflows where the agent needs to dynamically pick where to create threads — e.g., "start a thread in whichever conversation the original message came from."

In this path, you set **Target** to `Agent's Choice` and configure all target identifier fields so they appear in the tool schema. The agent then selects the destination family (`channel_id`, `channel_unique_name`, or `chat_id`) and provides the matching identifier on each tool call.

**Choose this path when:**
- The agent needs to decide where to create threads based on context or prior tool results
- Your workflow creates threads in different conversation types depending on the situation
- You are comfortable granting the agent access to create threads across channels and chats

**Important:** Do not mix the two paths in the same tool. Pick one, follow its dedicated setup guide, and configure only that path's fields.
