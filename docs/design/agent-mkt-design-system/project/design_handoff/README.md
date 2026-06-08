# Handoff: agent-mkt Design System

## Overview
This is the **agent-mkt Design System** — a monochrome, Threads-adjacent UI system built for HouseGuide.ai's AI social media agent console (小編審核台). It covers tokens (colors, typography, spacing), 9 React components, and a full interactive console UI kit.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes and component cards showing intended look and behavior, not production code to copy directly. Your task is to **recreate these designs in the target codebase** (`/Users/bryce_ni/wit/agent-mkt`) using its existing React + Electron environment and established patterns.

## Fidelity
**High-fidelity**: These are pixel-perfect mockups with final colors, typography, spacing, and interactions. Recreate the UI as closely as possible using the token values and component specs documented below.

---

## Screens / Views

### 1. 審核台 Console (`ui_kits/console/index.html`)
The main interactive console with three screens accessible via sidebar nav.

#### Layout
- Full viewport (`100vw × 100vh`), `display: flex`, `flex-direction: row`
- **Sidebar**: `width: 248px`, fixed, `background: var(--surface-card)`, `border-right: 1px solid var(--border-subtle)`, padding `18px 12px 20px`
- **Main area**: `flex: 1`, column flex, `overflow: hidden`
  - **Top header bar**: `height: 52px`, `border-bottom: 1px solid var(--border-subtle)`, `background: var(--surface-card)`, padding `0 28px`
  - **Content area**: `flex: 1`, scrollable

#### Sidebar
- Logo mark (30×30px SVG) + product name `agent-mkt` (700 / 15px) + client name `HouseGuide.ai` (mono / 12px / muted)
- Nav items: 海巡 (radar icon), 審核佇列 (inbox icon + pending count badge), 知識庫 (book-marked icon)
- Footer: version string `v0.1.0 · PoC` in mono/11px/faint
- Active nav item: `background: var(--brand-soft)`, `border: 1px solid var(--brand-soft-bd)`, `color: var(--brand-700)`
- Hover: `background: var(--surface-inset)`

#### Screen A — 海巡 (Scout)
- Max-width content area `740px`, padding `28px 36px`
- 2-column grid (`1fr 1fr`, `gap: 20px`) showing Keywords card + Threshold card
- Cards: `background: var(--surface-card)`, `border: 1px solid var(--border-subtle)`, `border-radius: var(--radius-lg)`, `padding: 18px`
- Section label style: `font: 600 12px/1 var(--font-mono)`, `letter-spacing: 0.06em`, `text-transform: uppercase`, `color: var(--text-muted)`
- Keyword pills: `background: var(--brand-soft)`, `color: var(--brand-700)`, `border: 1px solid var(--brand-soft-bd)`, `border-radius: var(--radius-pill)`, padding `5px 11px`
- Primary CTA: `執行海巡` — large primary Button with radar icon; shows spinner + disabled while running
- Results stats row: 4 metrics (瀏覽貼文 / 通過門檻 / 加入佇列 / 偵測訊號) displayed as large mono numbers with small sans labels

#### Screen B — 審核佇列 (Review Queue)
Two-column layout:
- **Left (flex: 1)**: scrollable review area, padding `22px 28px 28px`
- **Right rail (width: 300px)**: context sidebar, `background: var(--surface-card)`, `border-left: 1px solid var(--border-subtle)`, padding `20px 18px`

Sub-header bar (above columns): shows `第 N / Total 筆`, 已審 count, approval rate; turns warning color at ≥95%

**Review area contains:**
- Optional AlertBar (warning = fatigue warning at ≥95% approval rate; danger = rule flag violation)
- Original post block (`background: var(--surface-inset)`, radius-lg, padding 16px):
  - Avatar (28px circle, color-derived from handle initial) + @handle link + age timestamp
  - Engagement pills: 👍 likes / 💬 replies in mono font
  - Post text: `font: 14.5px/var(--lh-body) var(--font-sans)`
  - Thread excerpt strip if present
- Draft textarea: editable, `font: 15px/var(--lh-relaxed) var(--font-sans)`, char counter (max 60, turns danger color over limit)
- Action row (right-aligned): 跳過 (ghost) / 稍後再看 (secondary) / 通過並送出 (primary, disabled if rule-flagged or empty)

**Right rail contains:**
- 推薦理由: brand-tinted info box
- Threads metrics (likes / replies) in inset rows
- Persona description
- Queue status: pending/sent/skipped counts with StatusChips

**Empty state**: centered inbox icon + heading 沒有待審項目 + subtext

**Toast**: fixed bottom-center, `background: var(--ink-900)`, white text, `border-radius: var(--radius-lg)`, auto-dismiss after 2.2s

#### Screen C — 知識庫 (Knowledge Base)
- Max-width `680px`, padding `28px 36px`
- List of KB items: each is a card with file-text icon + title (600/14px) + excerpt (13.5px/muted)
- Info AlertBar at bottom: "知識庫編輯功能即將推出（階段三）"

---

## Interactions & Behavior

| Action | Behavior |
|---|---|
| 執行海巡 | Button shows spinner + disabled for 2.4s, then auto-navigates to 審核佇列 |
| 通過並送出 | 700ms async delay, item status → `"sent"`, approval counter increments, toast shows ✓ 已送出 |
| 跳過 | Item status → `"rejected"`, review counter increments, toast shows 跳過 |
| 稍後再看 | Advances to next item in queue (wraps) |
| Fatigue warning | Shown when `revCount >= 5` AND `approvedCount / revCount >= 0.95` |
| Rule flag block | `通過並送出` disabled; danger AlertBar shown with flag names |
| Lucide icons | Re-initialized via `lucide.createIcons()` on every screen/state change |

---

## State Management

```ts
// App-level
screen: "scout" | "review" | "kb"
items: ReviewItem[]   // status: "pending" | "sent" | "rejected"
scoutRunning: boolean

// ReviewScreen-level
idx: number           // current pending item index
edited: string        // draft text (mirrors item.edited_draft ?? item.draft)
revCount: number      // total reviewed this session
apprCount: number     // total approved this session
busy: boolean         // approve in-flight
toast: { msg, type } | null
```

---

## Design Tokens

### Colors
```css
/* Brand */
--brand:          #0d8268   /* primary teal-green */
--brand-hover:    #0a6856
--brand-soft:     #ecf7f3
--brand-soft-bd:  #d4efe7
--brand-700:      #0a6856   /* text on brand-soft */
--on-brand:       #ffffff

/* Text */
--text-strong:    #14171a
--text-body:      #262b31
--text-muted:     #69727b
--text-faint:     #8b949d
--text-link:      #0a6856

/* Surfaces */
--surface-page:   #fcfcfb
--surface-card:   #ffffff
--surface-sunken: #f4f4f2
--surface-inset:  #f5f6f7
--surface-ink:    #14171a

/* Borders */
--border-subtle:  #edeff1
--border-default: #d7dbe0
--border-strong:  #b6bdc4

/* Status */
--danger:         #c0392f   --danger-soft: #fcecea   --danger-bd: #f7d8d6   --danger-text: #9c2b2b
--warning:        #d29a2b   --warning-soft: #fef7e6  --warning-bd: #fbedc7  --warning-text: #92600e
--success:        #0d8268   --success-soft: #ecf7f3  --success-bd: #d4efe7  --success-text: #0a6856
--info:           #2a6cb0   --info-soft: #eaf2fb     --info-bd: #d8e7f7     --info-text: #1f4f86
```

### Typography
```css
--font-sans:  "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif
--font-serif: "Noto Serif TC", "Songti TC", Georgia, serif
--font-mono:  "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace

/* Scale */
--fs-display: 44px    --fs-title: 30px    --fs-h1: 23px     --fs-h2: 19px
--fs-h3: 16px         --fs-body: 15px     --fs-sm: 13.5px   --fs-xs: 12px
--fs-mono: 13px

/* Line heights */
--lh-tight: 1.18    --lh-snug: 1.4    --lh-body: 1.7    --lh-relaxed: 1.85

/* Weights */
--fw-regular: 400    --fw-medium: 500    --fw-bold: 700    --fw-black: 900
```

### Spacing (4px base)
```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80px
```

### Radii
```
--radius-xs: 4px    --radius-sm: 6px    --radius-md: 8px
--radius-lg: 12px   --radius-xl: 16px   --radius-pill: 999px
```

### Shadows
```css
--shadow-card:  0 1px 3px rgba(20,23,26,0.06), 0 8px 24px -12px rgba(20,23,26,0.14)
--shadow-pop:   0 6px 16px -4px rgba(20,23,26,0.12), 0 12px 40px -8px rgba(20,23,26,0.18)
```

### Motion
```css
--dur-fast: 120ms    --dur: 180ms    --dur-slow: 280ms
--ease-out: cubic-bezier(0.22, 1, 0.36, 1)
```

---

## Components

All 9 components are React JSX. The compiled bundle is `_ds_bundle.js`. Access via:
```js
const { Button, Card, Badge, Avatar, IconButton, NavItem, Field, TextArea, AlertBar, StatusChip, MetricChip } = window.AgentMktDesignSystem_ec4390;
```

| Component | Key Props |
|---|---|
| **Button** | `variant: primary\|secondary\|ghost\|danger`, `size: sm\|md\|lg`, `icon`, `iconRight`, `disabled`, `full` |
| **Card** | `pad`, `elevated`, `tone: card\|sunken\|inset` |
| **Badge** | `tone: neutral\|brand\|success\|warning\|danger\|info`, `solid` |
| **Avatar** | `handle` (monogram fallback), `src`, `size` (px diameter) |
| **IconButton** | Icon-only button variant |
| **NavItem** | Sidebar nav row with icon, label, optional count |
| **Field** | Labeled text input with `hint`, `invalid`, `mono` |
| **TextArea** | Multi-line with label + hint |
| **AlertBar** | `tone: danger\|warning\|info\|success`, `title`, `children` |
| **StatusChip** | `status: pending\|approved\|sent\|rejected\|later\|blocked\|relevant` |
| **MetricChip** | `kind: likes\|replies\|age\|followers`, `value`, `glyph` |

---

## Assets
- `assets/logo-mark.svg` — teal-green square logomark (30×30px in sidebar)
- `assets/wordmark-light.svg` — horizontal wordmark for light backgrounds
- `assets/wordmark-inverse.svg` — wordmark for dark backgrounds
- Icons: **Lucide** icon set (`https://unpkg.com/lucide@latest`) — load via CDN, init with `lucide.createIcons()`

---

## Files in This Package

```
design_handoff/
├── README.md                          ← this file
├── styles.css                         ← global stylesheet (imports all tokens)
├── tokens/
│   ├── colors.css
│   ├── typography.css
│   ├── spacing.css
│   ├── base.css
│   └── fonts.css
├── assets/
│   ├── logo-mark.svg
│   ├── wordmark-light.svg
│   └── wordmark-inverse.svg
└── ui_kits/
    └── console/
        └── index.html                 ← full interactive console reference
```

---

## Implementation Notes for Claude Code

1. **Target environment**: Electron + React (`/Users/bryce_ni/wit/agent-mkt/src/renderer/`)
2. **Existing entry**: `src/renderer/main.tsx` renders `src/renderer/review/App.tsx` — replace or extend `App.tsx` with these screens
3. **Token strategy**: Copy `tokens/*.css` into the renderer's CSS pipeline, or convert to a JS theme object matching your existing setup
4. **Icons**: The codebase may already have Lucide — check `package.json` for `lucide-react`; if present, use named imports instead of the CDN
5. **CJK fonts**: `Noto Sans TC` is available via Google Fonts (`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap')`)
6. **The HTML console file is the ground truth** — when in doubt, inspect `ui_kits/console/index.html` for exact styles and component behavior
