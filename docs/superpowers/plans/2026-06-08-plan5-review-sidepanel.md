# Plan 5: 審核台 Side Panel（React + Tailwind）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。
>
> **執行紀律（使用者偏好）**：速度優先、不 over-design、只做必要功能、不寫前期 unit test，測試後補。

**Goal:** 在 Chrome extension **side panel**（窄/單欄、RWD）做出**審核佇列** UI：列出 `pending` 的 review_item（原文 + 可編輯草稿 + 理由），人類可 **通過並送出 / 跳過 / 稍後再看**，寫回後端 store。視覺照 `docs/design/agent-mkt-design-system`（teal-green、ink/paper、Noto TC）。**用 React + Tailwind。** 海巡/知識庫頁先佔位。

**Architecture:** 後端加 `GET /reviews` + `POST /review` 與 store 查改。Extension 新增 WXT **React + Tailwind** 的 side panel entrypoint，直接 fetch 後端（擴充情境、host_permissions 已含 localhost，免 CSP/CORS）。

**Tech Stack:** WXT + `@wxt-dev/module-react` + React 19 + Tailwind CSS v4（`@tailwindcss/vite`）+ 既有後端。

**設計來源（像素級還原依據）：** `docs/design/agent-mkt-design-system/project/`
- `design_handoff/README.md` — 完整畫面/互動/狀態規格
- `design_handoff/tokens/*.css` — colors / typography / spacing（teal-green 品牌）
- `components/**/*.jsx` — 9 個元件參考實作（Card/Button/Badge/Avatar/StatusChip/MetricChip/AlertBar/TextArea/NavItem）
- `ui_kits/console/index.html` — 完整 console 互動參考

**對齊（已與使用者確認）：**
- 動作：通過並送出→`status=approved`（實際發文是 Plan 6）、跳過→`status=skipped`、稍後再看→跳下一筆不改狀態
- 先省略：rule_flags/紅色 AlertBar（無此資料）、thread_excerpt、followers
- 圖示**打包**（lucide-react / inline SVG），**不用 CDN**（MV3 CSP）；字體靠 fallback stack（不打包 web font）
- 顯示面 = 側欄（窄單欄）；完整桌面 console（sidebar+右 rail）留後面 plan

參考 spec §9、D5、§11 里程碑4。

---

### Task 1: store — 查詢/更新 review_item

**Files:** Modify `src/backend/store.ts`

- [ ] **Step 1: 加 getReviews + updateReviewItem**
在 `store.ts` 末端加（沿用既有 getDb / ReviewItemRow）：
```ts
export interface ReviewListItem {
  id: string;
  post: unknown; // ScoutCandidate（由 post_json 解析）
  reason: string;
  draft: string;
  status: string;
  created_at: string;
}

/** 取某租戶「相關且 pending」的審核項目，新到舊。 */
export function getReviews(tenant: string): ReviewListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT id, post_json, reason, draft, status, created_at
       FROM review_item
       WHERE tenant_id = ? AND relevant = 1 AND status = 'pending'
       ORDER BY created_at DESC`,
    )
    .all(tenant) as Array<{ id: string; post_json: string; reason: string; draft: string; status: string; created_at: string }>;
  return rows.map((r) => ({
    id: r.id,
    post: JSON.parse(r.post_json),
    reason: r.reason,
    draft: r.draft,
    status: r.status,
    created_at: r.created_at,
  }));
}

/** 更新一筆 review_item 的 status 與/或 draft。 */
export function updateReviewItem(id: string, patch: { status?: string; draft?: string }): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.status !== undefined) { sets.push("status = ?"); vals.push(patch.status); }
  if (patch.draft !== undefined) { sets.push("draft = ?"); vals.push(patch.draft); }
  if (!sets.length) return;
  vals.push(id);
  getDb().prepare(`UPDATE review_item SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}
```

- [ ] **Step 2: typecheck + test**

Run: `npm run typecheck && npm test`（21 綠）。

- [ ] **Step 3: Commit**
```bash
git add src/backend/store.ts
git commit -m "feat(backend): store getReviews + updateReviewItem"
```

---

### Task 2: server — GET /reviews + POST /review

**Files:** Modify `src/backend/server.ts`

- [ ] **Step 1: 加兩個路由**
import 加 `import { getReviews, updateReviewItem } from "./store.js";`。在 `createPollServer` 的 handler 內、`/poll` 與 `/result` 之外加：
```ts
    if (req.method === "GET" && url.pathname === "/reviews") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getReviews(tenant)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/review") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const { id, status, draft } = JSON.parse(body) as { id: string; status?: string; draft?: string };
        if (!id) throw new Error("missing id");
        updateReviewItem(id, { status, draft });
        res.statusCode = 204;
        res.end();
      } catch {
        res.statusCode = 400;
        res.end("bad review update");
      }
      return;
    }
```
（既有 CORS header、OPTIONS、/poll、/result、404 保留不動。）

- [ ] **Step 2: typecheck + curl smoke**

Run: `npm run typecheck`。啟 `npm run backend`，另開終端：
```bash
curl -s "http://127.0.0.1:18900/reviews?tenant=us"; echo
```
Expected: 回 JSON 陣列（可能 `[]` 若無 pending）。

- [ ] **Step 3: Commit**
```bash
git add src/backend/server.ts
git commit -m "feat(backend): GET /reviews + POST /review endpoints"
```

---

### Task 3: WXT React + Tailwind + design tokens 設定

**Files:** Modify `package.json`、`wxt.config.ts`；Create `entrypoints/sidepanel/`（index.html、main.tsx、App.tsx、style.css）、`entrypoints/sidepanel/tokens.css`

- [ ] **Step 1: 裝依賴**
```bash
npm install -D @wxt-dev/module-react tailwindcss @tailwindcss/vite --legacy-peer-deps
```
（react/react-dom 已在 deps。`@wxt-dev/module-react` 提供 WXT 的 React 支援；Tailwind v4 用 `@tailwindcss/vite` plugin。版本以實際安裝為準，若 v4 API 有出入，依官方 quickstart 最小調整。）

- [ ] **Step 2: `wxt.config.ts` 加 React module + Tailwind vite plugin + sidePanel 權限**
```ts
import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  outDir: "dist",
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "agent-mkt hands (dev)",
    permissions: ["alarms", "tabs", "sidePanel"],
    host_permissions: [
      "http://localhost/*",
      "http://127.0.0.1/*",
      "https://www.threads.com/*",
      "https://www.threads.net/*",
    ],
  },
});
```

- [ ] **Step 3: 帶入 design tokens**
把設計的 token css 合併成一份 `entrypoints/sidepanel/tokens.css`：複製 `docs/design/agent-mkt-design-system/project/design_handoff/tokens/colors.css`、`typography.css`、`spacing.css`、`base.css` 的 `:root{...}` 內容到這個檔（保留所有 CSS 變數）。

- [ ] **Step 4: 建 side panel entrypoint**
- `entrypoints/sidepanel/index.html`：標準 HTML，引 `main.tsx`，`<div id="root">`。
- `entrypoints/sidepanel/style.css`：
```css
@import "tailwindcss";
@import "./tokens.css";
html,body,#root { height: 100%; margin: 0; }
body { background: var(--surface-page); color: var(--text-body); font-family: var(--font-sans); }
```
- `entrypoints/sidepanel/main.tsx`：mount React App 到 `#root`，`import "./style.css"`。
- `entrypoints/sidepanel/App.tsx`：先放一個 `<div className="p-4">審核台</div>` 佔位（Task 5 補完）。

- [ ] **Step 5: 背景開啟 side panel**
在 `entrypoints/background.ts` 的 `defineBackground` 內最後加（讓點擴充圖示開側欄）：
```ts
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
```

- [ ] **Step 6: 建置 + typecheck**

Run: `npm run ext:build && npm run typecheck`
Expected: 成功；`dist/chrome-mv3/` 出現 sidepanel。若 React/Tailwind/WXT 版本問題導致 build 失敗，依錯誤最小修正（確認 `@wxt-dev/module-react` 已在 `modules`、Tailwind v4 plugin 已掛），並報告所改。

- [ ] **Step 7: Commit**
```bash
git add package.json package-lock.json wxt.config.ts entrypoints/sidepanel entrypoints/background.ts
git commit -m "feat(ext): WXT React + Tailwind side panel scaffold + design tokens"
```

---

### Task 4: review 元件（React + Tailwind，照設計）

**Files:** Create `entrypoints/sidepanel/components/`（Button.tsx、Card.tsx、Avatar.tsx、StatusChip.tsx、MetricChip.tsx、AlertBar.tsx）、`entrypoints/sidepanel/icons.tsx`

- [ ] **Step 1: 圖示（打包，不用 CDN）**
建 `icons.tsx`，輸出審核佇列會用到的少數 inline SVG icon component（如 `Inbox`、`Radar`、`BookMarked`、`Check`、`X`、`Clock`、`ThumbsUp`、`MessageCircle`、`Lightbulb`、`RefreshCw`）。可從 `docs/design/agent-mkt-design-system/project/assets` 或 lucide 取 path（24x24、`stroke="currentColor"`、`fill="none"`、`stroke-width:2`）。

- [ ] **Step 2: 基礎元件（用 Tailwind + token CSS 變數）**
依 `docs/design/.../design_handoff/README.md` 的元件規格 + `components/**/*.jsx` 參考，建：
- `Button.tsx`：props `variant: "primary"|"secondary"|"ghost"|"danger"`、`size`、`icon`、`disabled`、`full`。primary = `bg-[var(--brand)] text-[var(--on-brand)]`、hover `--brand-hover`；ghost/secondary 依 token；radius `--radius-md`。
- `Card.tsx`：`bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)]`，prop `tone: "card"|"sunken"|"inset"`、`pad`。
- `Avatar.tsx`：圓形，`handle` 取首字母當 monogram，背景由 handle 衍生色。
- `StatusChip.tsx`：`status: "pending"|"approved"|"sent"|"skipped"|"later"`，對應 token 色（pending=warning、sent/approved=success、skipped=neutral）。
- `MetricChip.tsx`：`kind: "likes"|"replies"`，mono 字 + glyph（👍/💬）。
- `AlertBar.tsx`：`tone: "warning"|"info"`，title + children（疲勞警示/提示用；rule danger 先不接資料）。

每個元件保持小、單一職責。**精確色/間距/字級一律引用 token CSS 變數**（已在 tokens.css）。

- [ ] **Step 3: 建置 + typecheck**

Run: `npm run ext:build && npm run typecheck`（成功、乾淨）。

- [ ] **Step 4: Commit**
```bash
git add entrypoints/sidepanel/components entrypoints/sidepanel/icons.tsx
git commit -m "feat(ext): review UI components (React + Tailwind, per design tokens)"
```

---

### Task 5: 審核佇列畫面 + app 殼 + 資料流

**Files:** Rewrite `entrypoints/sidepanel/App.tsx`；Create `entrypoints/sidepanel/api.ts`、`entrypoints/sidepanel/ReviewQueue.tsx`

- [ ] **Step 1: `api.ts`（fetch 後端）**
```ts
const BASE = "http://127.0.0.1:18900";
const TENANT = "us";

export interface ReviewPost {
  id: string; url: string; author_handle: string; text: string; likes: number; replies: number; posted_at: string;
}
export interface ReviewItem {
  id: string; post: ReviewPost; reason: string; draft: string; status: string; created_at: string;
}

export async function fetchReviews(): Promise<ReviewItem[]> {
  const r = await fetch(`${BASE}/reviews?tenant=${TENANT}`);
  return r.json();
}
export async function updateReview(id: string, patch: { status?: string; draft?: string }): Promise<void> {
  await fetch(`${BASE}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  });
}
```

- [ ] **Step 2: `ReviewQueue.tsx`（核心畫面）**
依 `design_handoff/README.md` 的「Screen B — 審核佇列」做**窄/單欄**版（省略右 rail，理由折入卡片下方）：
- 載入時 `fetchReviews()`；維護 `items`、目前 index、`edited`（草稿）、`toast`、session 計數（revCount/apprCount）。
- 每筆卡片（Card + 子元件）：
  - 頂部：Avatar + `@handle`（link 樣式）+ age（用 posted_at 算「Nh / N天前」）
  - MetricChip：👍likes / 💬replies
  - 原文：inset Card、`text-[15px] leading-[var(--lh-body)]`
  - 草稿 `<textarea>`：可編輯、`onChange` 更新 edited、**字數計數（上限 60，超過轉 danger 色）**
  - 💡 推薦理由：brand-tinted 小框（用 reason）
  - 動作列（右對齊）：`跳過`(ghost) / `稍後再看`(secondary) / `通過並送出`(primary，draft 空則 disabled)
- 動作行為：
  - **通過並送出** → `updateReview(id,{status:"approved",draft:edited})` → toast「✓ 已排入送出」→ 下一筆
  - **跳過** → `updateReview(id,{status:"skipped"})` → toast「跳過」→ 下一筆
  - **稍後再看** → 不打 API，跳下一筆（wrap）
  - 草稿失焦也可 `updateReview(id,{draft:edited})` 存（可選）
- **空狀態**：無 pending → 置中 inbox icon + 「沒有待審項目」+ subtext。
- **Toast**：底部置中、`bg-[var(--surface-ink)] text-white rounded-[var(--radius-lg)]`、2.2s 自動消失。
- （可選）疲勞警示 AlertBar：`revCount>=5 && apprCount/revCount>=0.95` 時顯示。

- [ ] **Step 3: `App.tsx`（殼 + 最小 nav）**
窄側欄的 app 殼：頂部一條（logo mark + `agent-mkt` + pending 數）+ 一個極簡分段 nav（**審核佇列**=active、**海巡**/**知識庫**=佔位，點了顯示「即將推出」佔位文字）。主內容預設 `<ReviewQueue/>`。

- [ ] **Step 4: 建置 + typecheck**

Run: `npm run ext:build && npm run typecheck`（成功、乾淨）。

- [ ] **Step 5: Commit**
```bash
git add entrypoints/sidepanel/App.tsx entrypoints/sidepanel/api.ts entrypoints/sidepanel/ReviewQueue.tsx
git commit -m "feat(ext): review queue side panel screen + app shell + data flow"
```

---

### Task 6（不執行，交給人）：端到端手動驗證

需先有資料（跑過 Plan 4b/4c 的 scout→review，`data/agent-mkt.db` 有 pending review_item）+ 重載擴充。
1. 啟後端 `npm run backend`
2. 重新載入擴充 → 點擴充圖示開 **side panel**
3. 應看到審核佇列：每筆原文 + 可編輯草稿（字數計數）+ 理由 + 三動作鈕，視覺為 teal-green/ink-paper 設計
4. 改草稿、按通過並送出 → toast、跳下一筆；後端 `data/agent-mkt.db` 該筆 status=approved、draft 更新
5. 全部審完 → 空狀態

---

## Self-Review

**Spec coverage：** §9 審核台 side panel（讀 review_item → approve/edit/reject）→ Task 5 ✅；§11 里程碑4 ✅；視覺照 design system ✅。

**YAGNI：** 只做審核佇列；海巡/知識庫佔位；省略 rule_flags/thread_excerpt/followers（無資料）；完整桌面 console 留後面；圖示打包不用 CDN；不打包 web font。

**一致性：** `GET /reviews`/`POST /review`（Task 2）↔ `api.ts`（Task 5）；store getReviews/updateReviewItem（Task 1）；動作語意 approved/skipped 對 D8/審核流程；視覺引用 design tokens。

**已知前提：** 需 `data/agent-mkt.db` 有 pending review_item（先跑 scout→review）；React/Tailwind/WXT 版本以實際安裝為準（Task 3 有調整指引）。

---

## 後續（不在本檔）
- **Plan 6**：發布(B) — content/actor postReply + 節流 sender 撈 `approved` 逐篇間隔發。
- **後面**：完整桌面 console（sidebar + 右 rail，寬斷點，同元件展開）；海巡頁、知識庫頁、設定頁。
