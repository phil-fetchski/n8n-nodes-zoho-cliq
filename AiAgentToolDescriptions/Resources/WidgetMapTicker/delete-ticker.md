# Widget Map Tickers: Delete Ticker

Use this guide to configure **Delete Ticker** for AI Tool mode in n8n.

This operation deletes one or more existing map tickers in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Set **Input Mode** to `Using JSON`.
- Use **Delete Ticker Payload (JSON)** for agent-controlled ticker deletion input, not the structured **Ticker IDs** collection.
- Do not delegate **Input Mode** to the agent.

If the target widget map belongs to a custom extension, set **Map Is Custom Extension** to true and provide **App Key**. Use the same `widget_id` and `map_id` values that were used to create or update the tickers.

Some Zoho reference material only shows `appkey` on add/update examples, but this node also supports `appkey` for delete when the target widget map belongs to a custom extension.

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
Delete one or more widget map tickers in Zoho Cliq using known `widget_id`, `map_id`, and a raw JSON body with a non-empty `ids` array. Use `map_is_custom_extension=true` and `appkey` only when the target map belongs to a custom extension.

The request body must be an object shaped like {"ids":["ticker_id_1","ticker_id_2"]}. Every `ids[]` entry must be a string ticker ID. Duplicate IDs are deduplicated before the request is sent. Unsafe keys such as `__proto__`, `constructor`, and `prototype` are rejected.

Successful responses return enhanced metadata with `success`, `resource`, `operation`, `widget_id`, `map_id`, `ids`, and `data`. Reuse `widget_id` and `map_id` for later add/update calls. Reuse `ids[]` to confirm which ticker IDs were targeted for deletion. `data` contains the raw Zoho Cliq delete response and may be an empty object for sparse success responses.

Example response:
{
  "success": true,
  "resource": "widgetMapTicker",
  "operation": "deleteTicker",
  "widget_id": "WD_01HXYZ8P4Y5M6N7Q8R9S",
  "map_id": "MAP_01HXYZ8Z4A5B6C7D8E9F",
  "ids": ["delivery_van_42"],
  "data": {}
}
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Widget ID (Required)

- Plain text description:
```txt
Required exact Zoho Cliq widget ID for the target widget map. Use the known widget ID only. This tool cannot discover widget IDs for you.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('widget_id', 'Required exact Zoho Cliq widget ID for the target widget map. Use the known widget ID only. This tool cannot discover widget IDs for you.', 'string') }}
```

---

### Map ID (Required)

- Plain text description:
```txt
Required exact Zoho Cliq map ID inside the selected widget. Use the known map ID only. This tool cannot discover map IDs for you.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('map_id', 'Required exact Zoho Cliq map ID inside the selected widget. Use the known map ID only. This tool cannot discover map IDs for you.', 'string') }}
```

---

### Map Is Custom Extension (Optional)

- Plain text description:
```txt
Optional boolean. Set true only when the target widget map belongs to a custom extension and you will also provide appkey. Leave false for normal widget maps.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('map_is_custom_extension', 'Optional boolean. Set true only when the target widget map belongs to a custom extension and you will also provide appkey. Leave false for normal widget maps.', 'boolean', false) }}
```

---

### App Key (Optional)

- Plain text description:
```txt
Optional extension app key. Required only when map_is_custom_extension is true. Leave empty for normal widget maps. This value is sent as the `appkey` query parameter.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('appkey', 'Optional extension app key. Required only when map_is_custom_extension is true. Leave empty for normal widget maps. This value is sent as the `appkey` query parameter.', 'string', '') }}
```

---

### Delete Ticker Payload (JSON) (Required When Input Mode = Using JSON)

- Plain text description:
```txt
Required top-level Zoho Cliq delete-ticker JSON object. This tool accepts either a stringified JSON object or a literal JSON object. Use the shape {"ids":["ticker_id_1","ticker_id_2"]}. `ids` must be a non-empty array of string ticker IDs. Duplicate IDs are deduplicated before the request is sent. Unsafe keys such as __proto__, constructor, and prototype are rejected.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('delete_ticker_payload', 'Required top-level Zoho Cliq delete-ticker JSON object. This tool accepts either a stringified JSON object or a literal JSON object. Use the shape {\"ids\":[\"ticker_id_1\",\"ticker_id_2\"]}. `ids` must be a non-empty array of string ticker IDs. Duplicate IDs are deduplicated before the request is sent. Unsafe keys such as __proto__, constructor, and prototype are rejected.', 'string') }}
```
