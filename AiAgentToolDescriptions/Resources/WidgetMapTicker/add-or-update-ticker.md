# Widget Map Tickers: Add or Update Ticker

Use this guide to configure **Add or Update Ticker** for AI Tool mode in n8n.

This operation adds one or more new map tickers, or updates existing ones, in Zoho Cliq.

## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Keep **Include Enhanced Output** enabled so the tool returns workflow-friendly success metadata.
- Do not delegate **Include Enhanced Output** or **AI Error Mode** to the agent.
- Set **Input Mode** to `Using JSON`.
- Use **Ticker Payload (JSON)** for agent-controlled ticker input, not the structured **Tickers** collection.
- Do not delegate **Input Mode** to the agent.

Use epoch milliseconds for `last_modified_time`. Some Zoho examples show 10-digit sample values, but this guide standardizes on milliseconds for stable agent behavior.

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
Add or update one or more widget map tickers in Zoho Cliq using known `widget_id`, `map_id`, and a raw JSON `tickers` object. Use `map_is_custom_extension=true` and `appkey` only when the target map belongs to a custom extension.

The request body must be an object with a non-empty `tickers` object. Each key inside `tickers` is the reusable ticker ID. Each ticker object must include `title`, `type`, `last_modified_time`, `latitude`, and `longitude`. `info` and `color` are optional. Each ticker may also include an optional `destination` object with `latitude` and `longitude` to enable live route tracking — when provided, the map draws a route from the ticker's current position to the destination. Only include `destination` when both coordinates are valid numbers; omit it entirely otherwise. Constraints: `title` max 20 characters, `info` max 30 characters, `type` ENUM: ["person", "bicycle", "motorcycle", "car", "van", "bus", "plane", "office", "home"], `color` ENUM: ["green", "red", "yellow"], `last_modified_time` positive whole number in epoch milliseconds, `latitude` between -90 and 90, `longitude` between -180 and 180, `destination.latitude` between -90 and 90, `destination.longitude` between -180 and 180. Destination coordinates are normalized to 7 decimal places. Unsafe keys such as `__proto__`, `constructor`, and `prototype` are rejected.

Successful responses return enhanced metadata with `success`, `resource`, `operation`, `widget_id`, `map_id`, `ticker_ids`, and `data`. Reuse `widget_id` and `map_id` for later ticker updates or deletes. Reuse `ticker_ids[]` for Delete Ticker. `data` contains the API response keyed by ticker ID. This tool updates live widget map state, but you should still persist the updated ticker data in your own application if your widget response must render that same state later.

Example response (with destination for route tracking):
{
  "success": true,
  "resource": "widgetMapTicker",
  "operation": "addOrUpdateTicker",
  "widget_id": "WD_01HXYZ8P4Y5M6N7Q8R9S",
  "map_id": "MAP_01HXYZ8Z4A5B6C7D8E9F",
  "ticker_ids": ["delivery_van_42"],
  "data": {
    "delivery_van_42": {
      "title": "TN 07 AL 9916",
      "type": "van",
      "last_modified_time": 1773891000000,
      "latitude": 12.84567,
      "longitude": 80.06092,
      "color": "green",
      "info": "Towards Zoho Corporation",
      "destination": {
        "latitude": 13.0827,
        "longitude": 80.2707
      }
    }
  }
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

### Ticker Payload (JSON) (Required When Input Mode = Using JSON)

- Plain text description:
```txt
Required top-level Zoho Cliq widget-map ticker JSON object. This tool accepts either a stringified JSON object or a literal JSON object. Use the shape {"tickers":{"ticker_id":{"title":"...","type":"van","last_modified_time":1773891000000,"latitude":12.84567,"longitude":80.06092,"info":"optional","destination":{"latitude":13.0827,"longitude":80.2707}}}}. The top-level `tickers` object must not be empty. Each nested key is the ticker ID you can reuse later. Each ticker object must include `title`, `type`, `last_modified_time`, `latitude`, and `longitude`. `info`, `color`, and `destination` are optional. `destination` is an object with `latitude` and `longitude` that enables live route tracking from the ticker position to the destination — only include it when both coordinates are valid. Constraints: `title` max 20 characters, `info` max 30 characters and not blank when present, `type` ENUM: ["person", "bicycle", "motorcycle", "car", "van", "bus", "plane", "office", "home"], `color` ENUM: ["green", "red", "yellow"], `last_modified_time` positive whole number in epoch milliseconds, `latitude` between -90 and 90, `longitude` between -180 and 180, `destination.latitude` between -90 and 90, `destination.longitude` between -180 and 180. Destination coordinates are normalized to 7 decimal places. Unsafe keys such as __proto__, constructor, and prototype are rejected.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('ticker_payload', 'Required top-level Zoho Cliq widget-map ticker JSON object. This tool accepts either a stringified JSON object or a literal JSON object. Use the shape {\"tickers\":{\"ticker_id\":{\"title\":\"...\",\"type\":\"van\",\"last_modified_time\":1773891000000,\"latitude\":12.84567,\"longitude\":80.06092,\"info\":\"optional\",\"destination\":{\"latitude\":13.0827,\"longitude\":80.2707}}}}. The top-level `tickers` object must not be empty. Each nested key is the ticker ID you can reuse later. Each ticker object must include `title`, `type`, `last_modified_time`, `latitude`, and `longitude`. `info`, `color`, and `destination` are optional. `destination` is an object with `latitude` and `longitude` that enables live route tracking from the ticker position to the destination — only include it when both coordinates are valid. Constraints: `title` max 20 characters, `info` max 30 characters and not blank when present, `type` ENUM: [\"person\", \"bicycle\", \"motorcycle\", \"car\", \"van\", \"bus\", \"plane\", \"office\", \"home\"], `color` ENUM: [\"green\", \"red\", \"yellow\"], `last_modified_time` positive whole number in epoch milliseconds, `latitude` between -90 and 90, `longitude` between -180 and 180, `destination.latitude` between -90 and 90, `destination.longitude` between -180 and 180. Destination coordinates are normalized to 7 decimal places. Unsafe keys such as __proto__, constructor, and prototype are rejected.', 'string') }}
```
