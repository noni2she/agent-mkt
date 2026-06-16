# Plan 9：發布 Poster（閉合 MVP 迴圈）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把使用者核准的 reply 草稿，經節流逐篇發到 Threads；發送成功後將 `review_item.status` 由 `approved` 改為 `sent`，並透過既有 StatusChip(sent="已送出") 在審核佇列反映。完成 MVP 閉環（海巡 → LLM 草稿 → 人審 → 發布）。

**Architecture:**
- **後端常駐 poster loop**（src/backend/poster.ts）：每隔短週期掃 `review_item where status='approved'`、按到舊到新挑一筆、呼叫既有 `SessionThrottle.gateReply()`（4–11 分鐘隨機冷卻）→ 透過 `CommandQueue.enqueue` 下 `post_reply` 指令 → 成功 → `updateReviewItem(id, {status:'sent'})`、失敗 → 記 log，留待人工處理（暫不重試，避免重複發送）。
- **新 Command：`post_reply`**（src/core/protocol.ts）：欄位 `{ action:"post_reply", postUrl, draft }`，content script 在 Threads 頁面開啟對應貼文 → 找到回覆輸入框 → 填字 → 送出 → 回傳 ok/element_not_found/fail。content script 依舊只讀寫 DOM、不直接連後端。
- **節流參數**（D16 護城河，沿用 Plan 8 的 `scoutTuning.ts` 模式）：新增 `posterTuning.ts`，集中 cooldown 區間、單 session 上限、poller 週期；`.env` 可覆寫。**不開放使用者**。
- **PoC 安全閘**：環境變數 `POSTER_DRY_RUN=1` 時，poster 走完整流程但**不真的送 DOM 提交**（content script 印 log + 回 ok）→ 讓開發者單機驗證 status 變化、節流節奏，不會誤觸真實帳號。預設**啟用 dry-run**，等手動驗證過再開實機。

**Tech Stack:** Node http + better-sqlite3、WXT content script、TypeScript。

**範圍邊界（YAGNI）：**
- 一次只發一篇、發完才考慮下一篇；無批次、無平行。
- 失敗**不自動重試**（避免重複貼文）；poster log 印錯誤、留 status 為 approved 由人工處理（手動再按一次核准即可重排）；極端情況可手動 sqlite 改 status。
- 不做「排程指定時間發送」、不做「跳過某篇」UI；既有「跳過」已蓋住這需求。
- 不做 retry-with-backoff、不做 dead-letter 表。MVP 後迭代。
- **content script 的 Threads 發布 DOM 流程是脆弱的**（Threads 改版常會壞）。本計畫提供**最小可行**選擇器，未來搬到 Plan 4c 風格的 adapter 層。

**驗證慣例：** typecheck + 21 測試綠 + ext:build；新邏輯（poster loop pick 順序、dry-run）加 1–2 個 vitest 純邏輯測試（不碰 DB、不碰 DOM）。後端 store 層仍維持無單元測試。人工 e2e 由使用者跑（先 dry-run，再切實機）。

---

## File Structure

- `src/backend/posterTuning.ts` — **Create**：cooldown/session cap/poll interval 預設 + `.env` 覆寫。比照 [scoutTuning.ts](../../../src/backend/scoutTuning.ts)。
- `src/core/protocol.ts` — **Modify**：`CommandSchema` 加 `post_reply` 分支。
- `src/backend/store.ts` — **Modify**：加 `getNextApproved(tenant)`（取最舊一筆 `status='approved'` 的 review_item，回 `{id, postUrl, draft}` 或 null）。
- `src/backend/poster.ts` — **Create**：常駐 loop（接 `CommandQueue` + `SessionThrottle`），dry-run 旗標。匯出 `startPoster(queue)` 給 main.ts 呼叫。
- `src/backend/poster.test.ts` — **Create**：純邏輯測試（dry-run 旗標、cooldown 取值範圍）。
- `src/backend/main.ts` — **Modify**：server.listen 後呼叫 `startPoster(queue)`，預設啟動。
- `entrypoints/content.ts` — **Modify**：加 `post_reply` handler；新函式 `postReply(postUrl, draft, signal)`，回傳 `{ok:true}` 或 `{ok:false, error}`。dry-run 由 SW/poster 端控（content script 收到就照樣發；簡化 IPC）。
- `.env.example` — **Modify**：列出 poster 旋鈕說明。

---

### Task 1：core/protocol.ts 加 `post_reply` 指令

**Files:**
- Modify: `src/core/protocol.ts`

- [ ] **Step 1: 在 CommandSchema 的 discriminatedUnion 內補一支**

把現有的 `CommandSchema` 改成（**只加新分支**，其餘維持）：

```ts
export const CommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ping") }),
  z.object({ action: z.literal("scout_stop") }),
  z.object({
    action: z.literal("scout"),
    keyword: z.string(),
    serpType: z.enum(["default", "recent"]).optional(),
    criteria: ScoutCriteriaSchema.partial().optional(),
    budget: ScoutBudgetSchema.partial().optional(),
    excludeIds: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("post_reply"),
    postUrl: z.string(),
    draft: z.string(),
    dryRun: z.boolean().optional(),
  }),
]);
```

- [ ] **Step 2: 跑既有測試確認沒回歸**

Run: `npm run typecheck && npm test`
Expected: typecheck exit 0；21 測試綠（protocol.test.ts 既有測試應對新 union 自動相容）。

---

### Task 2：posterTuning.ts（D16 節流參數）

**Files:**
- Create: `src/backend/posterTuning.ts`

- [ ] **Step 1: 整檔內容**

```ts
/**
 * 發布 poster 內部調校（D16 護城河）。
 *
 * 僅供開發者調節擬人化節奏 + 安全閘；不開放使用者。可在 .env 覆寫：
 *
 *   POSTER_DRY_RUN              "1"=啟用 dry-run（content script 不真的送 DOM）；預設 1
 *   POSTER_COOLDOWN_MIN_MIN     兩篇回覆之間最少分鐘數，預設 4
 *   POSTER_COOLDOWN_MIN_MAX     最多分鐘數，預設 11
 *   POSTER_MAX_PER_SESSION      單 session 最多發幾篇（避免一次失控），預設 10
 *   POSTER_SESSION_HOURS        single session 持續多久（小時），預設 3
 *   POSTER_POLL_MS              掃 DB 找下一篇 approved 的週期（毫秒），預設 5000
 */
function num(value: string | undefined, fallback: number): number {
  const n = value != null ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export interface PosterTuning {
  dryRun: boolean;
  cooldownMinRange: [number, number];
  maxPerSession: number;
  sessionHours: number;
  pollMs: number;
}

export function posterTuning(): PosterTuning {
  const env = process.env;
  return {
    dryRun: (env.POSTER_DRY_RUN ?? "1") === "1",
    cooldownMinRange: [num(env.POSTER_COOLDOWN_MIN_MIN, 4), num(env.POSTER_COOLDOWN_MIN_MAX, 11)],
    maxPerSession: num(env.POSTER_MAX_PER_SESSION, 10),
    sessionHours: num(env.POSTER_SESSION_HOURS, 3),
    pollMs: num(env.POSTER_POLL_MS, 5000),
  };
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: exit 0。

---

### Task 3：store.ts 加 `getNextApproved`

**Files:**
- Modify: `src/backend/store.ts`

- [ ] **Step 1: 在 `updateReviewItem` 之後加**

```ts
export interface NextApproved {
  id: string;
  postUrl: string;
  draft: string;
}

/** 取最舊一筆 status='approved' 的審核項，給 poster 發送；無則 null。 */
export function getNextApproved(tenant: string): NextApproved | null {
  const row = getDb()
    .prepare(
      `SELECT id, post_json, draft FROM review_item
       WHERE tenant_id = ? AND status = 'approved' AND TRIM(COALESCE(draft,'')) != ''
       ORDER BY created_at ASC LIMIT 1`,
    )
    .get(tenant) as { id: string; post_json: string; draft: string } | undefined;
  if (!row) return null;
  try {
    const post = JSON.parse(row.post_json) as { url?: string };
    if (!post.url) return null;
    return { id: row.id, postUrl: post.url, draft: row.draft };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: exit 0。

---

### Task 4：poster.ts — 常駐 loop

**Files:**
- Create: `src/backend/poster.ts`

- [ ] **Step 1: 整檔內容**

```ts
import { CommandQueue } from "./commandQueue.js";
import { posterTuning } from "./posterTuning.js";
import { getNextApproved, updateReviewItem } from "./store.js";
import { SessionThrottle } from "../core/throttle.js";

const TENANT = "us"; // 單一安裝＝單一租戶；多租戶推遲（沿用 Plan 8 範圍邊界）

/** 啟動發布 poster：常駐 loop，找 approved → 節流 → 下指令 → 標 sent。 */
export function startPoster(queue: CommandQueue): { stop: () => void } {
  const t = posterTuning();
  const throttle = new SessionThrottle(/* maxPerMin */ 1000, t.sessionHours, t.cooldownMinRange);
  let sentInSession = 0;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  console.log(`[poster] 啟動：dryRun=${t.dryRun} cooldown=${t.cooldownMinRange[0]}-${t.cooldownMinRange[1]}min maxPerSession=${t.maxPerSession} pollMs=${t.pollMs}`);

  const tick = async () => {
    if (stopped) return;
    if (sentInSession >= t.maxPerSession) {
      console.log(`[poster] 已達單 session 上限 ${t.maxPerSession}，停止本 session`);
      stopped = true;
      return;
    }
    if (throttle.sessionExpired()) {
      console.log(`[poster] session 已過 ${t.sessionHours}h，停止本 session`);
      stopped = true;
      return;
    }
    const next = getNextApproved(TENANT);
    if (!next) {
      timer = setTimeout(tick, t.pollMs);
      return;
    }
    console.log(`[poster] 取得 approved id=${next.id} → 等冷卻…`);
    await throttle.gateReply();
    if (stopped) return;
    try {
      const res = await queue.enqueue(
        TENANT,
        { action: "post_reply", postUrl: next.postUrl, draft: next.draft, dryRun: t.dryRun },
        90_000,
      );
      if (res.status === "ok") {
        updateReviewItem(next.id, { status: "sent" });
        sentInSession += 1;
        console.log(`[poster] ✅ 已${t.dryRun ? "（dry-run）" : ""}發送 id=${next.id}（本 session ${sentInSession}/${t.maxPerSession}）`);
      } else {
        console.warn(`[poster] ⚠️ 發送失敗 id=${next.id} status=${res.status} error=${res.error ?? ""}；保留 approved 由人工處理`);
      }
    } catch (e) {
      console.warn(`[poster] ⚠️ 發送 exception id=${next.id}：${(e as Error).message}；保留 approved 由人工處理`);
    }
    if (!stopped) timer = setTimeout(tick, t.pollMs);
  };

  timer = setTimeout(tick, t.pollMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: exit 0。

---

### Task 5：poster.test.ts — 純邏輯測試

**Files:**
- Create: `src/backend/poster.test.ts`

- [ ] **Step 1: 整檔內容（純測 tuning 解析，不碰 DB/queue）**

```ts
import { describe, expect, it } from "vitest";
import { posterTuning } from "./posterTuning.js";

describe("posterTuning", () => {
  it("defaults: dry-run on, cooldown 4-11, maxPerSession 10", () => {
    const before = { ...process.env };
    for (const k of Object.keys(process.env)) if (k.startsWith("POSTER_")) delete process.env[k];
    const t = posterTuning();
    expect(t.dryRun).toBe(true);
    expect(t.cooldownMinRange).toEqual([4, 11]);
    expect(t.maxPerSession).toBe(10);
    expect(t.sessionHours).toBe(3);
    expect(t.pollMs).toBe(5000);
    process.env = before;
  });

  it("env overrides take effect; invalid values fall back to defaults", () => {
    const before = { ...process.env };
    process.env.POSTER_DRY_RUN = "0";
    process.env.POSTER_COOLDOWN_MIN_MIN = "2";
    process.env.POSTER_COOLDOWN_MIN_MAX = "abc"; // invalid → fallback 11
    process.env.POSTER_MAX_PER_SESSION = "3";
    const t = posterTuning();
    expect(t.dryRun).toBe(false);
    expect(t.cooldownMinRange).toEqual([2, 11]);
    expect(t.maxPerSession).toBe(3);
    process.env = before;
  });
});
```

- [ ] **Step 2: 跑測試**

Run: `npm test`
Expected: 4 test files、23 tests 綠（原 21 + 新 2）。

- [ ] **Step 3: Commit（單元 A：後端 poster）**

```bash
git add src/core/protocol.ts src/backend/posterTuning.ts src/backend/store.ts src/backend/poster.ts src/backend/poster.test.ts
git commit -m "feat(backend): poster loop sends approved replies with throttle (dry-run by default)"
```

---

### Task 6：content.ts 加 `post_reply` handler

**Files:**
- Modify: `entrypoints/content.ts`

- [ ] **Step 1: 在現有的 `chrome.runtime.onMessage.addListener` 內補一支 handler**

在 `if (msg?.type === "scout_stop") { ... }` 之後、`return false;` 之前插入：

```ts
      if (msg?.type === "post_reply") {
        postReply(msg.postUrl as string, msg.draft as string, msg.dryRun === true)
          .then((r) => sendResponse(r))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;
      }
```

- [ ] **Step 2: 在檔案末端新增 `postReply` 函式**

```ts
/** 在當前已登入的 Threads 分頁開啟貼文 → 回覆草稿 → 提交。dryRun 時跑流程但不真的提交。 */
async function postReply(postUrl: string, draft: string, dryRun: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!draft || !draft.trim()) return { ok: false, error: "empty draft" };
  try {
    if (location.href !== postUrl) {
      // 同分頁導航；Threads 是 SPA，URL 變化會觸發貼文 modal/詳情頁載入
      window.location.assign(postUrl);
      // 等貼文容器出現
      await waitFor(() => document.querySelector('div[data-pressable-container="true"]') != null, 8000);
    }
    // 找回覆觸發鈕（aria-label 跨語系）
    const replyTrigger = findReplyTrigger();
    if (!replyTrigger) return { ok: false, error: "reply trigger not found" };
    replyTrigger.click();
    // 找輸入框（contenteditable）
    const editor = await waitForEl<HTMLElement>('div[contenteditable="true"][role="textbox"]', 6000);
    if (!editor) return { ok: false, error: "reply editor not found" };
    editor.focus();
    // 用 InputEvent 模擬鍵入；contenteditable 不接受 .value
    document.execCommand("insertText", false, draft);
    if (dryRun) {
      console.log("[poster] dry-run：流程完成但不送出", { postUrl, draftPreview: draft.slice(0, 40) });
      return { ok: true };
    }
    // 找送出鈕
    const submitBtn = findSubmitButton();
    if (!submitBtn) return { ok: false, error: "submit button not found" };
    submitBtn.click();
    // 確認送出成功（草稿框消失或變空）
    const success = await waitFor(() => {
      const e = document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement | null;
      return !e || (e.textContent ?? "").trim() === "";
    }, 8000);
    if (!success) return { ok: false, error: "submit timeout" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function findReplyTrigger(): HTMLElement | null {
  const selectors = [
    'svg[aria-label*="reply" i]',
    'svg[aria-label*="留言"]',
    'svg[aria-label*="回覆"]',
    'div[role="button"][aria-label*="reply" i]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return (el.closest('[role="button"]') as HTMLElement) ?? (el as HTMLElement);
  }
  return null;
}

function findSubmitButton(): HTMLElement | null {
  const selectors = [
    'div[role="button"][aria-label*="post" i]',
    'div[role="button"][aria-label*="送出"]',
    'div[role="button"][aria-label*="發布"]',
    'button[type="submit"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el as HTMLElement;
  }
  return null;
}

async function waitFor(pred: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function waitForEl<T extends Element>(selector: string, timeoutMs: number): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector) as T | null;
    if (el) return el;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}
```

> 註：選擇器是**最小可行**版本，Threads 改版時這裡會失效（會回 `element_not_found`，poster 不重試、保留 approved 由人工處理）。後續可搬到 adapter 層集中維護。

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run ext:build`
Expected: 皆 exit 0。

- [ ] **Step 4: Commit（單元 B：content 端發布）**

```bash
git add entrypoints/content.ts
git commit -m "feat(ext): content script post_reply handler (open post, fill draft, submit; dry-run aware)"
```

---

### Task 7：main.ts 啟動 poster + .env.example 文件

**Files:**
- Modify: `src/backend/main.ts`
- Modify: `.env.example`

- [ ] **Step 1: main.ts 在 server.listen 後啟動 poster**

加 import：

```ts
import { startPoster } from "./poster.js";
```

在 `server.listen(PORT, () => { ... })` 的 callback **最後** 加：

```ts
  startPoster(queue);
```

並把 shutdown 改成同時停 poster：

```ts
const poster = startPoster(queue); // 移到 listen 外面是否更乾淨？簡化：保留在 listen 內，shutdown 不必特意停（process 退出即收）
```

> 簡化做法：直接在 `listen` callback 內呼叫 `startPoster(queue)`，不持有 handle；process exit 時 setTimeout 自然中止。不需改 shutdown。

- [ ] **Step 2: `.env.example` 補上 poster 旋鈕**

把現有 scout 區塊後追加：

```bash

# 發布 Poster 內部調校（D16；不開放使用者）
# 預設值在 src/backend/posterTuning.ts；設了以下變數即覆寫。
POSTER_DRY_RUN=1               # 1=不真的送出 DOM（僅跑流程+log），0=實機送出。MVP 預設 1。
POSTER_COOLDOWN_MIN_MIN=4      # 兩篇之間最少分鐘
POSTER_COOLDOWN_MIN_MAX=11     # 兩篇之間最多分鐘
POSTER_MAX_PER_SESSION=10      # 單 session 最多發幾篇
POSTER_SESSION_HOURS=3         # session 最長持續小時
POSTER_POLL_MS=5000            # 掃 approved 週期（ms）
```

- [ ] **Step 3: typecheck + 全部測試**

Run: `npm run typecheck && npm test && npm run ext:build`
Expected: 皆綠（23 tests）。

- [ ] **Step 4: Commit（單元 C：佈線）**

```bash
git add src/backend/main.ts .env.example
git commit -m "feat(backend): wire poster into main; document POSTER_* env knobs"
```

---

### Task 8（人工 e2e，交給使用者）

**Dry-run 階段（預設）**：
1. `npm run backend`（先關掉舊 backend）；`npm run ext:build` → 重載擴充。確保 Threads 已登入。
2. 進審核佇列，核准 1 篇（status 變 approved；推薦理由可見）。
3. 看 backend log：應在 4–11 分鐘後出現 `[poster] dry-run：流程完成但不送出 ...`。**Threads 不會真的多一則回覆**。
4. 約幾秒後該卡片 StatusChip 變「已送出」（自動刷新後）。
5. 連核准 3 篇 → 應看到 cooldown 隨機分佈、逐篇送出。

**實機階段（手動切換）**：
6. 在 `.env` 加 `POSTER_DRY_RUN=0` → 重啟 backend。
7. 核准 1 篇 → 等待 → 應在 Threads 該貼文下看到你的回覆，且該卡片 status 變「已送出」。
8. 失敗（例如選擇器失效）→ backend log 印警告 + status 保留 approved，**不會重發**。

---

## Self-Review

**1. Spec coverage：**
- §11 里程碑「發布閉合 MVP」→ Task 4 poster loop + Task 6 content 發布 ✅
- D16「cooldown/節奏/擬人＝平台內部，不開放使用者」→ posterTuning 不入 tenant_config/UI ✅
- §10 「approved → 排入待發 → 真發」→ Task 3 getNextApproved + Task 4 enqueue 流程 ✅
- 「失敗不自動重試」邊界 → Task 4 catch 後保留 approved ✅
- D16 dry-run 安全閘 → posterTuning.dryRun + content.ts dryRun 透傳 ✅

**2. Placeholder scan：** code step 皆完整；驗證皆有預期值；無 TBD。✅

**3. Type consistency：**
- `post_reply` 欄位（postUrl/draft/dryRun?）在 protocol(Task1)/poster(Task4)/content(Task6) 一致 ✅
- `getNextApproved` 回傳形（id/postUrl/draft）在 store(Task3)/poster(Task4) 一致 ✅
- `posterTuning()`/`PosterTuning` 在 posterTuning(Task2)/poster(Task4)/poster.test(Task5) 一致 ✅
- `SessionThrottle` 從 src/core/throttle.ts 來；建構簽章 `(maxPerMin, sessionMaxHours, replyCooldownMinRange)` ✅（poster.ts:第 3 任務）

**已知前提：** StatusChip 已支援 sent="已送出"（不需改前端）；ReviewQueue 自動刷新 4 秒會把 status 從 approved → sent 帶入畫面（已在 Plan 8 確認保留決定紀錄）。

---

## 後續（不在本檔）

- **adapter 層集中維護 Threads DOM 選擇器**（reply trigger / editor / submit），讓 Plan 9 的脆弱選擇器有家可放。
- **失敗重試/dead-letter**（真有實機資料後再決定策略）。
- **發送節奏觀察儀表板**（已發數 / 下次預估時間 / 健康度），目前僅在 backend log。
- **多租戶**：poster TENANT 寫死 "us"，等真·多租戶才動。
