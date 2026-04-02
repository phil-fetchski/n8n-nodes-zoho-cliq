# Message Component Builder: Agent Card Payload Builder

Use this guide to configure **Agent Card Payload Builder** for AI Tool mode in n8n.

Use this operation to build one validated rich message payload object in Zoho Cliq for later reuse in **Post Message**, **Edit Message**, or **Schedule Message**.

- Set **Resource** to `Message Component Builder`.
- Set **Operation** to `Agent Card Payload Builder`.
## Manual Tool Settings

Set these manually when using this operation as an AI Tool:
- Enable **AI Error Mode** so validation or API failures return actionable recoverable payloads instead of stopping the tool chain.
- Do not delegate **AI Error Mode** to the agent.
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
Use this tool to build one validated rich message payload object in Zoho Cliq for later reuse in Post Message, Edit Message, or Schedule Message. When another tool needs a raw JSON card payload, prefer using this builder instead of hand-authoring `card`, `slides`, or `buttons`.

The tool always requires top-level `text`.

Optional top-level card fields:
- `theme` ENUM: ["modern-inline", "basic", "poll", "prompt"]
- `title`
- `icon`
- `thumbnail`

Optional `slides` is a JSON array of slide objects. The tool accepts either a native JSON array or a stringified JSON array. Leave it empty or omit it when no slides are needed. Supported slide `type` ENUM: ["table", "list", "images", "text", "label", "percentage_chart", "graph"].

Detailed slide guidance:
- A Zoho Cliq slide is one structured content block inside the card body. Think of each slide as one visual section under the main `text` and `card` header. If you need multiple sections, add multiple objects to the `slides` array in the order you want them shown.
- General slide shape:
  - required `type`
  - optional `title`
  - usually required `data`
  - optional `styles`
  - optional slide-level `buttons`
- If a slide includes `buttons`, those buttons belong only to that slide. The top-level `buttons` array belongs to the whole card.
- Use `text` for paragraph content, `label` for key/value metadata, `list` for bullet-style items, `table` for tabular data, `images` for galleries, `percentage_chart` for parts-of-a-whole totals, and `graph` for trend/category comparisons.
- `text` slide:
  - purpose: one paragraph or summary block
  - accepted keys: `type`, `title`, `data`, optional `buttons`
  - `type`: `"text"`
  - `data`: one non-empty string, max 1000 characters
  - example:
    `{ "type": "text", "title": "Summary", "data": "Everything is healthy." }`
- `images` slide:
  - purpose: a gallery or set of screenshots
  - accepted keys: `type`, `title`, `data`, optional `buttons`
  - `type`: `"images"`
  - `data`: array of direct HTTPS image URLs
  - example:
    `{ "type": "images", "title": "Screenshots", "data": ["https://example.com/one.png", "https://example.com/two.png"] }`
- `label` slide:
  - purpose: compact metadata rows such as owner, severity, status, region, environment, or ticket number
  - accepted keys: `type`, `title`, `data`, optional `buttons`
  - `type`: `"label"`
  - `data`: array of objects that normally act like labeled rows, for example `{ "key": "Status", "value": "Open" }`
  - example:
    `{ "type": "label", "title": "Metadata", "data": [{ "key": "Status", "value": "Open" }, { "key": "Owner", "value": "Platform Team" }] }`
- `table` slide:
  - purpose: a small structured matrix of columns and rows
  - accepted keys: `type`, `title`, `data`, optional `buttons`
  - `type`: `"table"`
  - `data`: table object with required `headers` array and optional `rows` array
  - `headers`: non-empty array of column-name strings
  - `rows`: array of JSON objects
  - each row object must use the header names as its keys
  - each row should include values for every header and should not introduce keys that are not present in `headers`
  - optional `data.styles.width`: array of positive numbers with one entry per header; all values together must add up to 100
  - optional `data.styles.sticky.rows` and `data.styles.sticky.columns`: whole numbers from 0 to 2
  - example:
    `{ "type": "table", "title": "Details", "data": { "headers": ["Name", "Team", "Reporting To"], "rows": [{ "Name": "Paula Rojas", "Team": "Zylker-Sales", "Reporting To": "Li Jung" }, { "Name": "Quinn Rivers", "Team": "Zylker-Marketing", "Reporting To": "Patricia James" }], "styles": { "width": [30, 30, 40], "sticky": { "rows": 1, "columns": 1 } } } }`
- `list` slide:
  - purpose: checklist-style or bullet-style content
  - accepted keys: `type`, `title`, `data`, optional `buttons`
  - `type`: `"list"`
  - `data`: array of list item strings
  - example:
    `{ "type": "list", "title": "Next Steps", "data": ["Validate config", "Deploy workflow"] }`
- `percentage_chart` slide:
  - purpose: percentages that must represent a full 100% total
  - accepted keys: `type`, `title`, `data`, optional `styles`, optional `buttons`
  - `type`: `"percentage_chart"`
  - `data`: array of chart point objects with `label` and numeric `value`
  - all chart values together must add up to exactly 100
  - optional `styles.preview` ENUM: ["pie", "doughnut", "semi_doughnut"]
  - example:
    `{ "type": "percentage_chart", "title": "Traffic Split", "data": [{ "label": "API", "value": 65 }, { "label": "Worker", "value": 35 }], "styles": { "preview": "doughnut" } }`
- `graph` slide:
  - purpose: compare values across categories, periods, or named groups
  - accepted keys: `type`, `title`, `data`, optional `styles`, optional `buttons`
  - `type`: `"graph"`
  - `data`: array of graph category objects
  - each `data` item requires:
    - `category`: non-empty string, max 20 characters
    - `values`: non-empty array of objects with required `label` and numeric `value`
  - each `values` item requires:
    - `label`: non-empty string, max 20 characters
    - `value`: number
  - optional `styles.preview` ENUM: ["vertical_bar", "vertical_stacked_bar", "trend"]
  - example:
    `{ "type": "graph", "title": "Weekly Volume", "data": [{ "category": "Asana", "values": [{ "label": "Jan", "value": 12 }, { "label": "Feb", "value": 20 }, { "label": "Mar", "value": 28 }] }, { "category": "BitBucket", "values": [{ "label": "Jan", "value": 10 }, { "label": "Feb", "value": 18 }, { "label": "Mar", "value": 30 }] }], "styles": { "preview": "vertical_bar" } }`

Each slide may also include its own `buttons` array.

Optional top-level `buttons` is a JSON array of button objects for the card itself. The tool accepts either a native JSON array or a stringified JSON array. Supported button action `type` ENUM: ["invoke.function", "open.url", "system.api", "copy", "preview.url"].

High-level button guidance:
- required `label` must be a non-empty string with maximum length 20 characters
- optional `key` is the button's unique identifier. Provide it when downstream button handling must map a click to a specific button, especially for `invoke.function`. If omitted, this builder auto-generates one.
- `open.url` requires at least one of `url`, `web`, `android`, or `ios`
- `invoke.function` requires `action.data.name`
- `system.api` requires `action.data.api`
- `copy` requires `action.data.text` or `action.data.value`
- `preview.url` requires HTTPS `action.data.url`

The tool returns one validated payload object directly, not a wrapper. Successful output shape:
{
  "text": "Message text",
  "card": {
    "title": "Optional title",
    "theme": "modern-inline",
    "icon": "https://example.com/icon.svg",
    "thumbnail": "https://example.com/thumb.png"
  },
  "slides": [
    {
      "type": "text",
      "title": "Optional slide title",
      "data": "Slide text"
    }
  ],
  "buttons": [
    {
      "label": "Open Dashboard",
      "key": "open_dashboard_1",
      "action": {
        "type": "open.url",
        "data": {
          "url": "https://example.com/dashboard"
        }
      }
    }
  ]
}

Reuse the returned object as the full raw JSON payload in Zoho Cliq Post Message, Edit Message, or Schedule Message.
```

## Required vs Optional Behavior (Important)

There are **two ways** to give your agent control over a field. Choose one per field, not both:

1. **✨ Sparkles (plain text description)** — Enable `Let the model define this parameter` on a field, then paste the plain text description suggested for that input in this guide. The description input is only visible after enabling ✨ Sparkles. Fields configured this way are **always required** — the agent must provide a value every time, even if the API considers the field optional. If you use ✨ Sparkles, always provide the suggested description — many agents will struggle with Zoho-specific terminology without the context and explanation these descriptions provide.

2. **`$fromAI()` expression (recommended)** — Toggle the field to expression input and paste the suggested `$fromAI()` expression from this guide. When the expression includes a **fourth argument** (the default value), the field is **optional** — the agent can see and control it but is not required to provide a value. When the expression has only three arguments (name, description, type), the field is **required** in the tool schema. This flexibility is why `$fromAI()` is the recommended path — optional inputs stay optional, and the agent only has to fill what actually needs to be decided.

If you don't want the agent to control a field at all, keep it hardcoded or use a normal n8n expression.

If neither ✨ Sparkles nor a `$fromAI()` expression is set on an input, the agent will not know that input exists — it will not appear in the tool schema at all. It is highly recommended to provide your agent access to certain additional inputs that you might not consider, like pagination features. For example, if a tool has a `limit` input, giving your agent access to it can save your agent from ingesting large API responses — and save you money.

## Suggested Field Setup

### Card Theme (Optional)

- Plain text description:
```txt
Optional card theme string. Leave blank to omit. ENUM: ["modern-inline", "basic", "poll", "prompt"].
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('theme', 'Optional card theme string. Leave blank to omit. ENUM: ["modern-inline", "basic", "poll", "prompt"].', 'string', '') }}
```

---

### Card Title (Optional)

- Plain text description:
```txt
Optional card title shown in the `card.title` field. Leave blank to omit.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('title', 'Optional card title shown in the card.title field. Leave blank to omit.', 'string', '') }}
```

---

### Card Text (Required)

- Plain text description:
```txt
Required top-level message text for the Zoho Cliq payload. Supports Cliq markdown such as `*bold*`, `_italics_`, `~strike~`, inline code, code blocks, and links. Maximum 4096 characters in this builder so the output remains safe for Post Message, Edit Message, and Schedule Message reuse.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('text', 'Required top-level message text for the Zoho Cliq payload. Supports Cliq markdown such as *bold*, _italics_, ~strike~, inline code, code blocks, and links. Maximum 4096 characters in this builder so the output remains safe for Post Message, Edit Message, and Schedule Message reuse.', 'string') }}
```

---

### Card Icon URL (Optional)

- Plain text description:
```txt
Optional direct HTTPS image URL for `card.icon`. Leave blank to omit. Must point directly to a `.png` or `.svg` file.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('icon_url', 'Optional direct HTTPS image URL for card.icon. Leave blank to omit. Must point directly to a .png or .svg file.', 'string', '') }}
```

---

### Card Thumbnail URL (Optional)

- Plain text description:
```txt
Optional direct HTTPS image URL for `card.thumbnail`. Leave blank to omit. Must point directly to a `.png` or `.svg` file.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('thumbnail_url', 'Optional direct HTTPS image URL for card.thumbnail. Leave blank to omit. Must point directly to a .png or .svg file.', 'string', '') }}
```

---

### Slides JSON (Optional)

- Plain text description:
```txt
Optional JSON array of Zoho Cliq slide objects. Provide either a native JSON array or a stringified JSON array. Leave blank to omit slides. Each array item becomes one slide. Supported slide `type` ENUM: ["table", "list", "images", "text", "label", "percentage_chart", "graph"]. A `text` slide requires non-empty string `data`. A `table` slide requires `data.headers` as a non-empty array of unique header strings with no duplicates, and any `data.rows` entries must be JSON objects whose keys exactly match those unique header names. Optional `data.styles.width` must contain one positive number (greater than 0) per header and all width values together must add up to 100. Optional `data.styles.sticky.rows` and `data.styles.sticky.columns` must be whole numbers from 0 to 2. An `images` slide requires `data` as valid absolute HTTPS image URLs. A `percentage_chart` slide requires chart values that add up to 100. A `graph` slide requires each `data` item to include required `category` and `values` keys, where `values` is a non-empty array of objects and each object must include a string `label` key and a numeric `value` key. Each slide may also include its own `buttons` array.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('slides_json', 'Optional JSON array of Zoho Cliq slide objects. Provide either a native JSON array or a stringified JSON array. Leave blank to omit slides. Each array item becomes one slide. Supported slide type ENUM: ["table", "list", "images", "text", "label", "percentage_chart", "graph"]. A text slide requires non-empty string data. A table slide requires data.headers as a non-empty array of unique header strings with no duplicates, and any data.rows entries must be JSON objects whose keys exactly match those unique header names. Optional data.styles.width must contain one positive number (greater than 0) per header and all width values together must add up to 100. Optional data.styles.sticky.rows and data.styles.sticky.columns must be whole numbers from 0 to 2. An images slide requires data as valid absolute HTTPS image URLs. A percentage_chart slide requires chart values that add up to 100. A graph slide requires each data item to include required category and values keys, where values is a non-empty array of objects and each object must include a string label key and a numeric value key. Each slide may also include its own buttons array.', 'string', '[]') }}
```

---

### Buttons JSON (Optional)

- Plain text description:
```txt
Optional JSON array of top-level card button objects. Provide either a native JSON array or a stringified JSON array. Leave blank to omit card buttons. Each button requires a non-empty string `label` with maximum length 20 characters. Supported button action `type` ENUM: ["invoke.function", "open.url", "system.api", "copy", "preview.url"]. Optional `key` is the button's unique identifier and helps map a button click to the correct action, especially for `invoke.function`. `open.url` requires at least one of `url`, `web`, `android`, or `ios`. `invoke.function` requires `action.data.name`. `system.api` requires `action.data.api`. `copy` requires `action.data.text` or `action.data.value`. `preview.url` requires HTTPS `action.data.url`.
```
- Suggested `$fromAI()`:
```txt
{{ $fromAI('buttons_json', 'Optional JSON array of top-level card button objects. Provide either a native JSON array or a stringified JSON array. Leave blank to omit card buttons. Each button requires a non-empty string label with maximum length 20 characters. Supported button action type ENUM: ["invoke.function", "open.url", "system.api", "copy", "preview.url"]. Optional key is the button\'s unique identifier and helps map a button click to the correct action, especially for invoke.function. open.url requires at least one of url, web, android, or ios. invoke.function requires action.data.name. system.api requires action.data.api. copy requires action.data.text or action.data.value. preview.url requires HTTPS action.data.url.', 'string', '[]') }}
```
