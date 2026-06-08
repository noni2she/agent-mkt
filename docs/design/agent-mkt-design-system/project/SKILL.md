---
name: agent-mkt-design
description: Use this skill to generate well-branded interfaces and assets for agent-mkt — an AI 小編 SaaS for Threads marketing with a human-in-the-loop review console. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping or production work.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Link `styles.css` (entry point) for all design tokens.

If working on production code, read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick start

```html
<!-- Link the token system -->
<link rel="stylesheet" href="styles.css">
<!-- Load Lucide icons (monoline, 1.75 stroke) -->
<script src="https://unpkg.com/lucide@latest"></script>
<!-- Load reusable components -->
<script src="_ds_bundle.js"></script>
```

Then use tokens directly:
```css
background: var(--surface-card);
color: var(--text-body);
border: 1px solid var(--border-default);
border-radius: var(--radius-lg);
font-family: var(--font-sans);
```

## Brand essence

- **Product:** agent-mkt — AI 小編 (community manager) SaaS for Threads, human-in-the-loop safety model.
- **Demo tenant:** HouseGuide.ai (Taiwan real-estate AI data analytics).
- **Personality:** Trustworthy, literate, data-driven. A careful newsroom social desk — fast but accountable.
- **Language:** Traditional Chinese (zh-TW) first; English for labels, metrics, code.
- **Color:** Patrol teal-green (`--brand-600 #0d8268`) is the single accent. Everything else is ink/paper.
- **Safety semantics:** teal=go, amber=caution, red=stop/blocked. Always soft tinted capsules, never saturated blocks.
- **Icons:** Lucide monoline set, 1.75 stroke, 16–20px, `currentColor`.
- **Type:** Noto Sans TC (UI), Noto Serif TC (display/titles), JetBrains Mono (metrics/handles/code).
- **Motion:** Calm — 120–280ms fades/slides, `cubic-bezier(0.22,1,0.36,1)`, no bounce.

## Key components

| Component | Path | Use for |
|-----------|------|---------|
| Button | `components/core/Button.jsx` | All actions; `primary`=approve, `danger`=destructive |
| Badge | `components/core/Badge.jsx` | Labels, counts |
| StatusChip | `components/review/StatusChip.jsx` | Review decision states |
| MetricChip | `components/review/MetricChip.jsx` | Threads metrics (likes/replies/age) |
| AlertBar | `components/review/AlertBar.jsx` | Hard-rule violations, fatigue warnings |
| NavItem | `components/core/NavItem.jsx` | Sidebar navigation |
| TextArea | `components/forms/TextArea.jsx` | Draft editor with char counter |
| Field | `components/forms/Field.jsx` | Labeled inputs |

## Content rules (brief)

- UI copy: 繁體中文, functional verbs (`執行海巡`, `通過並送出`, `跳過`), no exclamation marks, no emoji in chrome.
- Brand drafts: ≤60 字, conversational, emoji whitelist only 📊 🏠 📈, ends with open assertion.
- Metric chips: keep native emoji (👍 / 💬) as data labels only.
- Hard rules: always visible and blocking; never hide why a send is disabled.

## Files

```
styles.css              global entry (import list only)
tokens/                 colors · typography · spacing · fonts · base
assets/                 logo-mark.svg · logo-wordmark.svg · logo-wordmark-inverse.svg
guidelines/             specimen cards (Colors · Type · Spacing · Brand)
components/core/        Button · IconButton · Badge · Avatar · Card · NavItem
components/forms/       Field · TextArea
components/review/      StatusChip · MetricChip · AlertBar
ui_kits/console/        interactive review console (index.html)
readme.md               full design guide
```
