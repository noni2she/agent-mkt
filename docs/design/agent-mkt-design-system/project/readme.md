# agent-mkt — Design System

> Visual + content design system for **agent-mkt**, an AI 小編（社群小編）SaaS that
> helps brands run marketing on **Threads** — finding popular posts (海巡 / Scout),
> drafting on-brand replies, and writing original posts — always with a human in the loop.

---

## 1. Product context

**agent-mkt** is a non-commercial PoC evolving toward a multi-tenant SaaS. It gives a
brand's marketing team an AI "小編" (community manager) that works **Threads** on their
behalf, under strict human review.

Three core jobs:

| 中文 | Job | What it does |
|------|-----|--------------|
| **海巡** | **Scout** | Browses Threads for popular posts matching the brand's keywords + popularity thresholds. |
| **Reply** | **Reply** | Drafts an on-brand reply to a relevant popular post. Never sends without approval. |
| **原創貼文** | **Original post** | Writes brand-voice marketing posts (Phase 2). |

**The defining principle is human-in-the-loop safety.** Sending is *always* triggered by a
human in the **審核台 (Review console)**. The product deliberately resists "approve-all"
behaviour: it forces the reviewer to read each original post, decides one item at a time,
flags hard-rule violations as un-sendable, and warns when the approval rate is suspiciously
high (review fatigue). The visual language must feel **calm, deliberate, and trustworthy** —
this is a tool that says *slow down and look*, not a growth-hacking dashboard.

**Language:** Traditional Chinese (zh-TW) first; English appears in labels, metrics, and
code. Typography and layout are tuned for dense CJK reading.

**Tenancy:** Single-brand today, tenant-aware data model. The example tenant throughout this
system is **HouseGuide.ai** — a Taiwan real-estate AI data-analytics platform (auto-valuation
for new builds, urban-renewal market radar; audience 28–50, cares about house prices,
pre-sale units, urban renewal, property investment).

### Sources

This system was authored by reading the **agent-mkt** codebase (read-only mount `agent-mkt/`),
an Electron + WXT (Chrome Extension) + React project:

- `src/renderer/review/App.tsx` — the original (placeholder-styled) review console.
- `src/shared/types.ts`, `src/core/` — `ReviewItem`, `ScoutedPost`, `Persona`, `BusinessRules`, prompt assembly.
- `configs/agent/*.md`, `configs/*.yaml` — persona, owned-product (HouseGuide.ai), marketing
  strategy, content-writing rules, business rules, popularity criteria.
- `data/review-queue.json`, `data/queue.json` — real scouted posts + draft replies (used as sample content).
- `docs/redesign-brief.md` — the redesign brief calling for a polished Extension + Electron product.

> **Note on visual identity:** the PoC shipped only placeholder inline styles (`system-ui`,
> a single `#0a7` green). The brand, palette, type, and components here are **newly
> established** per the redesign brief — grounded in the product's safety-first character and
> Threads-adjacent minimalism, not copied from a prior visual design.

---

## 2. Content fundamentals

How copy is written across the product UI and in generated brand content.

**Two registers — keep them distinct:**

1. **Product-UI voice (the tool talking to the operator)** — concise, operational, calm.
   Traditional Chinese, functional. Buttons are verbs: `執行海巡`, `通過並送出`, `跳過`,
   `稍後再看`. Status is plain: `待審 3｜本批已審 12｜通過率 92%`. Safety copy is direct and
   unhedged: `此草稿命中硬規則，不可送出`. No exclamation-mark hype, no emoji in chrome,
   no "🎉 You're all caught up!" cheerleading. The tone is a careful colleague, not a mascot.

2. **Brand-content voice (the AI 小編 drafting for HouseGuide.ai)** — set per-tenant by the
   persona. For HouseGuide.ai: 繁體中文, conversational, data-driven but warm — *"像一個懂房市
   的朋友在聊天，不是業務在推銷"*. 1–3 short sentences, ≤60 字. Emoji **少而精**: 📊 🏠 📈 only.
   Ends on an open, slightly-unfinished assertion that invites a reply — never a forced
   question, never a slogan like "數據說話", never a hard sell.
   Example draft: *"日本泡沫提醒一件事：高槓桿＋普遍樂觀很危險，買房別只看價格，利率和流動性也要算進來 📊"*

**Casing & punctuation:** Chinese uses full-width punctuation（，。「」）. Latin labels in the
UI are lowercase or Title Case; the only UPPERCASE is the mono eyebrow micro-label
(e.g. `SCOUT`, `REVIEW QUEUE`). Metrics read as glyph+number: `👍954`, `💬148`, `301h`.

**Person:** UI addresses the operator as **你** ("你有逐條讀過原文"). Brand content speaks as
the brand to its audience.

**Emoji policy:** **none** in product chrome. In brand drafts, a tight whitelist only
(📊 🏠 📈 ☕ ✨ depending on persona). Unicode action glyphs (▶ ✓ ✕ ↓ ⚠) were used by the PoC
and are replaced by a proper icon set — see §5.

**Vibe:** trustworthy, literate, a little editorial. Think a well-run newsroom's social desk:
fast but accountable, with a paper trail.

---

## 3. Visual foundations

**Overall:** monochrome, paper-and-ink, Threads-adjacent. A near-white warm paper
(`--paper #fcfcfb`), cool-neutral ink for text (`--ink-950 #14171a`), and a single confident
brand: **patrol teal-green** (`--brand-600 #0d8268`). The green is not decorative — it carries
meaning (go / safe / approved), echoing the PoC's `#0a7` approve button. Everything else stays
quiet so the brand and the status semantics read instantly.

**Color & semantics.** The palette is built around the review console's decision states:
- **Teal-green = go / approved / safe** (`--success`).
- **Amber = caution / pending review / fatigue warning** (`--warning`, soft bg `#fef7e6`,
  carried over from the PoC's `#fff3cd`).
- **Red = stop / hard-rule violation / un-sendable** (`--danger`).
- **Blue = neutral info**. **Coral** (`--coral-600`) appears *only* as the Threads likes/heart
  metric accent.
Status colours always appear as a **soft tinted capsule** (tint bg + 1px tinted border + dark
tinted text), never as a saturated block. Color is reserved; large areas are paper, ink, and
hairline borders.

**Typography.** Three families, all production-safe for zh-TW:
- **Noto Sans TC** — UI + body. The workhorse. Weights 400/500/700/900.
- **Noto Serif TC** — editorial display & marketing headlines (`.u-title`, `.u-display`). Used
  sparingly for moments of weight, giving the product its "literate newsroom" feel.
- **JetBrains Mono** — handles (`@gecko.3379405`), metrics, timestamps, IDs, eyebrow labels.
Body line-height is generous (`--lh-body 1.7`) because CJK needs air. Display is tight
(`1.18`, `-0.02em`). Minimum UI text is 12px; body is 15px.

**Spacing & layout.** 4px base scale. Generous internal padding on cards (16–24px). A fixed
left **sidebar** (`--sidebar-w 248px`) for product nav; the review console adds a right
**context rail** (`--console-rail 320px`) so the original post stays pinned beside the draft.
Reading measure for posts/drafts capped at `--reading 720px`.

**Backgrounds.** No gradients, no photographic hero washes, no patterns. Flat paper with
hairline structure. Depth comes from a 2-tone surface system (`--surface-page` paper →
`--surface-card` white → `--surface-sunken` for inset wells like the "原文" quote block).

**Borders, radii, cards.** Hairline borders (`1px var(--border-default)`) do most structural
work. Radii are soft-but-square: controls 8px, cards 12px, insets 10px, full pills only for
status chips/avatars. A **card** = white surface, 1px subtle border, 12px radius, and a
*restrained* cool shadow (`--shadow-card`) — never a heavy drop shadow. The amber/red "alert"
blocks are the only place a coloured left/all border is allowed, and always as a soft capsule.

**Elevation.** Cool-grey shadows (`rgba(20,23,26,…)`), never pure black. Four steps:
`xs` (subtle lift) → `card` → `pop` (menus/tooltips) → `modal`. Sparing.

**Motion.** Calm and deliberate — a safety tool shouldn't bounce. Durations 120–280ms,
`--ease-out cubic-bezier(0.22,1,0.36,1)`. Transitions are **fades and short slides** only; no
springy overshoot, no infinite loops. Respect `prefers-reduced-motion`.

**Interaction states.**
- *Hover:* surfaces darken ~4% (`--ink-50`/`--surface-sunken`); primary button → `--brand-hover`.
- *Press:* darken further (`--brand-pressed`) + 1px nudge, no scale.
- *Focus:* 3px brand-tinted ring (`--shadow-focus`), never removed.
- *Disabled:* 45% opacity, no pointer. The "通過並送出" button is disabled (not hidden) when a
  hard-rule fires or the draft is empty — the operator should *see* why they can't send.

**Transparency / blur.** Minimal. A subtle paper-coloured backdrop blur is allowed on sticky
headers and modal scrims only; content surfaces stay opaque for legibility of CJK text.

---

## 4. Iconography

The PoC used bare unicode glyphs (`▶ ✓ ✕ ↓ ⚠ 👍 💬`). The system standardises on
**[Lucide](https://lucide.dev)** — a clean, open, 1.5–2px monoline set whose minimal,
slightly-rounded geometry matches the Threads-adjacent aesthetic. There were **no icon
assets in the codebase to import**, so Lucide is adopted (not substituting an existing set).

- **Delivery:** `<script src="https://unpkg.com/lucide@latest"></script>` then
  `lucide.createIcons()`, or `<i data-lucide="search"></i>`. Stroke `1.75`, sized 16/18/20px to
  match text. Colour inherits `currentColor`.
- **Key icons in use:** `radar`/`search` (海巡 Scout), `message-square-reply` (reply),
  `pen-line` (original post), `check` (approve), `x` (skip), `arrow-down` (later),
  `shield-alert` (hard rule), `triangle-alert` (caution/fatigue), `clock` (pending),
  `users` (followers), `heart` (likes), `book-marked` (knowledge base).
- **Threads metrics** keep their platform-native emoji (👍 / 💬) *inside metric chips only*,
  because that's how the source data is labelled — they are data, not UI chrome.
- **Brand drafts** use the persona emoji whitelist (📊 🏠 📈). No emoji anywhere else.

**Logo / brand mark:** `assets/logo-mark.svg` + `assets/logo-wordmark.svg` — a monoline
"scout ping" (a reply bubble crossed by a radar sweep) in patrol teal. Newly created for this
system; see §1 note. Available on paper (`assets/logo-wordmark.svg`) and ink
(`assets/logo-wordmark-inverse.svg`).

---

## 5. Index / manifest

```
styles.css            ← consumers link THIS (import manifest only)
tokens/
  fonts.css           Google-CDN Noto Sans TC / Noto Serif TC / JetBrains Mono
  colors.css          ink/paper scale, patrol-teal brand, status semantics + aliases
  typography.css      families, weights, scale, line-heights, role tokens
  spacing.css         space scale, radii, shadows, motion, layout widths
  base.css            reset + element defaults + .u-* helpers
assets/               logos (mark / wordmark / inverse)
guidelines/           foundation specimen cards (Type · Colors · Spacing · Brand)
components/core/       reusable React primitives (see below)
ui_kits/console/       agent-mkt 審核台 — full interactive product recreation
readme.md             ← this file
SKILL.md              Agent-Skills manifest (portable to Claude Code)
```

**Components** (`components/core/`): `Button`, `IconButton`, `Badge`, `StatusChip`, `MetricChip`,
`Avatar`, `Card`, `Field`, `TextArea`, `AlertBar`, `NavItem`. Each ships `.jsx` + `.d.ts` +
`.prompt.md` + a `@dsCard` HTML demo.

**UI kits**: `ui_kits/console/` — the agent-mkt review console (sidebar → scout dashboard →
review queue → knowledge base), an interactive click-through recreation.

> The Design System tab renders every `@dsCard`-tagged HTML. Start there for a visual tour.
