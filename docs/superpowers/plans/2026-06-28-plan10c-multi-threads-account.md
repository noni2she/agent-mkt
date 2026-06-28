# Plan 10c：Threads 多帳號管理 + 登入身份檢查 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把目前「單一 Threads 帳號」的隱式假設變成顯式的 multi-account 模型。1 個 install（=user=tenant=brand）底下可新增 N 個 threads_account，全域有一個 `active_threads_account_id`，所有海巡/審核/發稿都 scope 在 active 帳號。同時新增「Threads 分頁實際登入帳號 vs agent active 帳號」的硬擋檢查，避免 A 操作 B 的誤觸。

**Why this matters:** Plan 10a 完成後 MVP 迴圈閉合，但仍是隱式單帳號（既有 `threads_handle` 在 session.md 寫得是「純辨識標籤」、不參與決策）。要服務「個人/小品牌經營者一人多面（主品牌 + 個人 + 員工人格）」的真實需求，必須有顯式的多帳號模型 + 切換 + 各帳號的人格/策略/寫稿規則獨立。

**Architecture (合併市場 A 決策):**
- **身份模型**：1 個 install ＝ 1 個 user ＝ 1 個 tenant ＝ 1 個 brand。三概念合併、不引入註冊登入（**留給 Plan 10b**）。
- **agent_def C 方案**：`owned_product` 仍 per-tenant（品牌共用一份）；`persona / marketing_strategy / content_writing_rule` 改 per-threads_account（每帳號獨立一份）。
- **active 切換器**：全域單一 `active_threads_account_id` 存在 `tenant_config`。切換時做 `hasPreviewing` 守門（有預覽中就阻擋）。
- **per-account throttle**：`SessionThrottle` 用 `Map<accountId, SessionThrottle>` 改 per-account，切換帳號不重置冷卻。`sentInSession` 也 per-account。
- **登入身份硬擋**：scout / post_reply command 帶 `expectedHandle`（active account 的 handle），content script 在執行前讀 DOM 取當前 Threads 登入 handle、比對；不符回 `account_mismatch`，poster 視同 `element_not_found` 保留 `status=approved` 不重試。
- **Migration**：runtime idempotent 升級 — 第一次 boot 偵測沒有 threads_account 時：(1) 建一個 default account；(2) 把既有 `agent_def kind=persona/strategy/writing_rule` 內容搬到該 default account 的欄位；(3) 把既有 review_item 的 threads_account_id 寫成 default；(4) 設 `active_threads_account_id = default`；(5) 保留 `agent_def kind=owned_product` 不動。
- **Plan 10b forward-compat**：所有新 endpoint 仍走 `/api/v1/`；所有後端 query 仍接 tenant 變數；threads_account 表 schema 為未來加 `user_id` FK 留位（即 `tenant_id` 仍是主要租戶 key）。

**Tech Stack:** 既有 — Node http + better-sqlite3、WXT、TypeScript、React + Tailwind v4、`@openai/agents`。

## Global Constraints

整份 plan 的每個 task 都隱含套用以下規則，不再個別重複：

- 維持 D17：tenant 仍 hardcode `"us"`，schema 接 tenant 變數但 UI 不暴露任何 tenant 切換
- 所有新 endpoint 必須在 `/api/v1/` 前綴下；既有舊 endpoint 暫不動
- 既有 `buildReviewerInstructions` 注入順序 persona → owned_product → strategy → rule **不可改**（內容來源可換）
- 實機路徑（`POSTER_DRY_RUN=0` 跑 `status=sent`）行為**完全不可動**；本 plan 只改 dry-run、active 帳號切換、登入身份檢查流程
- 既有 Plan 10a 預覽流程（`status=previewing` 守門）必須仍生效，只是 scope 從 per-tenant 變成 per-(tenant, account)
- 軟刪除（`deleted_at IS NOT NULL`）的 `threads_account` 一律從 `listAccounts`、active 候選、KnowledgeView tab 中排除
- DOM 選擇器集中在 `entrypoints/content.ts`，失效時 fail-safe（不執行任何 DOM 動作，回 `element_not_found` 或 `account_mismatch`）
- 任何 `ALTER TABLE` 走 idempotent migration pattern（try/catch 吞 "duplicate column" 錯誤），沿用 Plan 10a `previewing_at` 的寫法
- 所有 query 仍接 tenant 變數（不寫死字面常數）；hardcode `"us"` 只發生在 server.ts / poster.ts 的呼叫端

## Execution Protocol

每個 task 是一個 commit 邊界。執行流程：

1. **Codex 實作**：依該 task 的 steps 寫 code + 跑 `npm run typecheck && npm test`（UI task 加 `npm run ext:build`），**不要 commit**
2. **Codex 停下回報**：印 `git diff --stat`、新檔清單、測試結果、任何待解決的疑問
3. **主 session（人類 + Claude）review**：
   - 驗 Interfaces 的 Produces 是否如實提供（簽名、欄位、回傳型別）
   - 驗 Global Constraints 沒被違反
   - 驗測試是「真的測行為」而非「斷言永真」
   - 驗實作行為符合 task Goal、不溢出本 task 範圍
4. **review 通過** → 主 session 給 Codex 對應的 commit message → Codex 執行 `git add` + `git commit`
5. **review 不過** → 主 session 列具體要修的點 → Codex 修正後回到步驟 2
6. 一個 clean commit 完成後才進下一個 task；中途絕不跨 task 改動

**範圍邊界 (YAGNI):**
- 不做註冊/登入/token auth（Plan 10b）。
- 不做多 user / lock / assignment / soft-presence（Plan 11+）。
- 不做 tenant 切換 UI（隱形）。
- 不做 active 切換之外的進階搜尋過濾（ReviewQueue 只 scope active）。
- 不做帳號數量上限的 hard cap（軟性建議 5 以下，UI 不擋）。
- 不做歷史 review_item 跨帳號遷移 / 重新 assign。

**驗證慣例：** typecheck + 26+ 測試綠（新增 4–5 個 store/poster/throttle 測試）+ ext:build；人工 e2e 含「Plan 10a 預覽流程仍生效」+「multi-account 切換」+「mismatch 觸發 banner」。

---

## File Structure

- `src/backend/store.ts` — **Modify**：新增 `threads_account` schema（idempotent CREATE TABLE）；`tenant_config` 加 `active_threads_account_id`；新增一批 helpers（見 Task 1/2）；`review_item` 加 `threads_account_id` 欄位 + idempotent migration。
- `src/backend/storeMigration.ts` — **Create**：runtime 第一次 boot 的 default account 建立 + agent_def 搬遷 + review_item 補欄位邏輯，single entry point。`main.ts` 啟動時呼叫一次。
- `src/backend/main.ts` — **Modify**：server.listen 前呼叫 `runDefaultAccountMigration(tenant)`。
- `src/backend/poster.ts` — **Modify**：throttle / sentInSession / hasPreviewing / getNextApproved 全部 keyed by active account；tick 開頭讀 `tenant_config.active_threads_account_id`，沒設就 sleep 後重試。
- `src/backend/poster.test.ts` — **Modify**：補 per-account throttle 隔離測試（切換不重置冷卻）+ active 為空時 tick 不抓的測試。
- `src/backend/coordinator.ts` / `reviewer.ts` — **Modify**：reviewer prompt 注入時，`owned_product` 從 tenant agent_def 拿、`persona/strategy/writing_rule` 從 active threads_account 拿；保留 `buildReviewerInstructions` 原本順序 persona → owned_product → strategy → rule，內容來源換。
- `src/backend/server.ts` — **Modify**：新增 5 個 endpoint（accounts CRUD + active selector，見 Task 5）；`/scout` endpoint 帶上 active account 的 handle 進 command；`/result` 處理新 `account_mismatch` status 一致照 `element_not_found` 流程。
- `src/core/protocol.ts` — **Modify**：`CommandSchema` 的 scout / post_reply 分支加 `expectedHandle?: string`；`ResponseEnvelopeSchema` 的 status enum 加 `"account_mismatch"`。
- `entrypoints/content.ts` — **Modify**：新增 `getCurrentThreadsHandle()`；scout / postReply 在執行前若 `expectedHandle` 存在則比對、不符即時 abort 回 `account_mismatch`；DOM selector 待實機驗（任務內列 3 個 fallback）。
- `entrypoints/background.ts` — **Modify**：`PolledCommand` 帶上 `expectedHandle`；`handlePostReply` / scout 路由把它原樣 forward 給 content；無新邏輯（content 端負責檢查）。
- `entrypoints/sidepanel/api.ts` — **Modify**：新增 `listAccounts / createAccount / deleteAccount / getActiveAccount / setActiveAccount` 5 個 API helper。
- `entrypoints/sidepanel/AccountsView.tsx` — **Create**：新 view，列所有帳號 + 新增表單 + 軟刪除 + 設為 active；切換時若 hasPreviewing 顯示確認 dialog（後端會回 409，前端先攔一道 UX）。
- `entrypoints/sidepanel/components/AccountSwitcher.tsx` — **Create**：Header 的小 dropdown，顯示當前 active handle、可下拉切換、最後一項是「+ 新增帳號」。
- `entrypoints/sidepanel/App.tsx` — **Modify**：Header 嵌入 AccountSwitcher；nav 加 AccountsView entry；SetupWizard 完成後若無 threads_account 強制跳到「新增第一個帳號」。
- `entrypoints/sidepanel/SetupWizard.tsx` — **Modify**：在原本「填 owned_product」之後加一步「新增第一個 threads_account（handle + display_name + persona 必填、strategy/rule 預設）」。
- `entrypoints/sidepanel/KnowledgeView.tsx` — **Modify**：頂部加 tabs ─「品牌資訊」（編 owned_product，沿用既有 UI）+ 每個 threads_account 一個 tab（編該帳號的 persona/strategy/writing_rule，沿用 textarea）。
- `entrypoints/sidepanel/ReviewQueue.tsx` — **Modify**：fetch reviews 帶 `accountId=active` query；列表只顯示 active 帳號的 item；卡片增加「@當前帳號」chip（避免使用者切換後忘記）。
- `entrypoints/sidepanel/ScoutView.tsx` — **Modify**：海巡不再讓使用者選帳號（永遠 active），UI 加一行說明「海巡身份：@當前 active 帳號」。
- `entrypoints/sidepanel/components/AlertBar.tsx` — **Modify**：新增 `tone="account-mismatch"` style；ReviewQueue / ScoutView 共用元件渲染「Threads 分頁登入是 @X、active 是 @Y，請切換」訊息。
- `entrypoints/sidepanel/components/StatusChip.tsx` — **Modify**：加 `account_mismatch` tone（danger）+ label「帳號不符」。
- `.handoff/session.md` — **Modify**：Plan 10c progress 打勾、Key Decisions 加多帳號模型 + 登入身份檢查、e2e 步驟擴充。

---

## Tasks

### Task 1：threads_account schema + tenant_config 加欄位 + idempotent migration runtime

**Files:**
- Modify: `src/backend/store.ts`
- Create: `src/backend/storeMigration.ts`
- Modify: `src/backend/main.ts`

**Interfaces:**

- **Consumes**: 既有 `store.getDb()`、既有 `tenant_config` / `review_item` / `agent_def` schema
- **Produces**:
  - `store.ts` schema：新 `threads_account` 表（欄位見 Step 1）、`tenant_config` 新欄位 `active_threads_account_id TEXT`、`review_item` 新欄位 `threads_account_id TEXT`
  - `storeMigration.ts`：`runDefaultAccountMigration(tenant: string): void`（idempotent；無 threads_account 時建一個 default、搬 agent_def 的 persona/strategy/rule 到該帳號欄位、補 review_item.threads_account_id、清掉 agent_def 對應 row、設 active；有則 no-op）
  - `main.ts`：server.listen 前呼叫 `runDefaultAccountMigration("us")`

- [ ] **Step 1: store.ts CREATE TABLE threads_account**
  ```sql
  CREATE TABLE IF NOT EXISTS threads_account (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    handle TEXT NOT NULL,
    display_name TEXT NOT NULL,
    persona TEXT NOT NULL DEFAULT '',
    marketing_strategy TEXT NOT NULL DEFAULT '',
    content_writing_rule TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_threads_account_tenant ON threads_account(tenant_id) WHERE deleted_at IS NULL;
  ```

- [ ] **Step 2: tenant_config 加 `active_threads_account_id`**
  - idempotent `ALTER TABLE tenant_config ADD COLUMN active_threads_account_id TEXT` 套 try/catch 沿用 Plan 10a `previewing_at` 的 pattern。

- [ ] **Step 3: review_item 加 `threads_account_id`**
  - 同上 idempotent migration。先允許 NULL（既有資料才有得遷）。

- [ ] **Step 4: storeMigration.ts 寫 `runDefaultAccountMigration(tenant)`**
  - 邏輯：
    1. **若 `tenant` 表沒有對應 tenant_id 的 row（= 尚未 onboard）→ 直接 return**（避免新裝 install 留下 phantom default account；SetupWizard 在 Task 7 會建第一個帳號）
    2. 若該 tenant 已存在 ≥1 個非軟刪 threads_account → 直接 return（已遷過）
    3. 否則：建 default account
       - id = `uuid()`、handle = `"default"`、display_name = 既有 tenant.brand_name 或 `"預設帳號"`
       - persona/strategy/rule 從 `agent_def` 表抓既有欄位內容、抓不到就空字串
    4. 更新 `tenant_config.active_threads_account_id = default.id`
    5. `UPDATE review_item SET threads_account_id = default.id WHERE tenant_id = ? AND threads_account_id IS NULL`
    6. **agent_def 是寬表（PK=tenant_id、4 個內容欄位 + updated_at）**：清空 persona/marketing_strategy/content_writing_rule 三欄為空字串、保留 owned_product 欄位與整列 row（**不要 DELETE 整列**）
    7. 整段包在 `db.transaction(() => {...})()` 內，要嘛全成功要嘛全 rollback

- [ ] **Step 5: main.ts 啟動時呼叫**
  - server.listen 前一行：`runDefaultAccountMigration("us");`

- [ ] **Step 6: typecheck + test**
  - `npm run typecheck && npm test` → 既有 26 綠

---

### Task 2：store 新增 multi-account helpers

**Files:**
- Modify: `src/backend/store.ts`

**Interfaces:**

- **Consumes**: Task 1 的 schema（`threads_account` 表、`tenant_config.active_threads_account_id`、`review_item.threads_account_id`）
- **Produces**:
  - `ThreadsAccount` interface（id, tenant_id, handle, display_name, persona, marketing_strategy, content_writing_rule, created_at）
  - `listThreadsAccounts(tenant: string): ThreadsAccount[]`（排除 deleted）
  - `getThreadsAccount(id: string): ThreadsAccount | null`
  - `createThreadsAccount(input: Omit<ThreadsAccount,'id'|'created_at'>): ThreadsAccount`
  - `updateThreadsAccount(id: string, patch: Partial<Pick<ThreadsAccount,'display_name'|'persona'|'marketing_strategy'|'content_writing_rule'>>): void`
  - `softDeleteThreadsAccount(id: string): void`
  - `getActiveAccountId(tenant: string): string | null`
  - `setActiveAccountId(tenant: string, accountId: string | null): void`
  - `getActiveAccount(tenant: string): ThreadsAccount | null`（組合上述兩者）
  - **改簽名**：`hasPreviewing(tenant: string, accountId: string): boolean`
  - **改簽名**：`sweepStalePreviews(tenant: string, accountId: string, timeoutMin: number): number`
  - **改簽名**：`getNextApproved(tenant: string, accountId: string): NextApproved | null`
  - **改型別**：`saveReviewItem` 的 row 加必填 `threads_account_id: string`

- [ ] **Step 1: account CRUD**
  ```ts
  export interface ThreadsAccount {
    id: string;
    tenant_id: string;
    handle: string;
    display_name: string;
    persona: string;
    marketing_strategy: string;
    content_writing_rule: string;
    created_at: string;
  }
  export function listThreadsAccounts(tenant: string): ThreadsAccount[];      // WHERE deleted_at IS NULL
  export function getThreadsAccount(id: string): ThreadsAccount | null;
  export function createThreadsAccount(input: Omit<ThreadsAccount, 'id' | 'created_at'>): ThreadsAccount;
  export function updateThreadsAccount(id: string, patch: Partial<Pick<ThreadsAccount, 'display_name' | 'persona' | 'marketing_strategy' | 'content_writing_rule'>>): void;
  export function softDeleteThreadsAccount(id: string): void;                  // SET deleted_at = now
  ```

- [ ] **Step 2: active selector**
  ```ts
  export function getActiveAccountId(tenant: string): string | null;          // 從 tenant_config 讀
  export function setActiveAccountId(tenant: string, accountId: string): void;
  export function getActiveAccount(tenant: string): ThreadsAccount | null;    // 組合 getActiveAccountId + getThreadsAccount
  ```

- [ ] **Step 3: account-scoped 改造**
  ```ts
  // 從 Plan 10a 既有的擴充：
  export function hasPreviewing(tenant: string, accountId: string): boolean;  // 加參數
  export function sweepStalePreviews(tenant: string, accountId: string, timeoutMin: number): number;
  export function getNextApproved(tenant: string, accountId: string): NextApproved | null;  // WHERE threads_account_id = ?
  ```
  - 既有呼叫端會破。下個 Task 補 poster 端，這個 Task 先讓 typecheck 過（既有測試會壞、Task 3 修）。

- [ ] **Step 4: scout 寫入時帶 account_id**
  - `saveReviewItem` row 的型別加 `threads_account_id: string` 必填。
  - 既有呼叫端（coordinator）尚未提供 → 暫時讓 typecheck 失敗、Task 3 修。
  - **不要為了 typecheck 過就放 nullable** — 必填才能保證新資料不會漏。

- [ ] **Step 5: typecheck（會有預期失敗）**
  - 列出失敗點記成 TODO，Task 3 / 4 / 5 處理。

---

### Task 3：coordinator + reviewer C 方案注入

**Files:**
- Modify: `src/backend/coordinator.ts`
- Modify: `src/backend/reviewer.ts`
- Modify: `src/backend/agentDef.ts`（若有）

**Interfaces:**

- **Consumes**: Task 2 的 `getActiveAccount(tenant)`、`ThreadsAccount` 型別；既有 `getAgentDef(tenant, "owned_product")`
- **Produces**:
  - `reviewer.buildReviewerInstructions` **簽名變更**：新增 `account: ThreadsAccount` 參數；內部 persona/strategy/rule 內容改從 account 欄位拿、owned_product 仍從 agent_def 表拿；注入順序維持 persona → owned_product → strategy → rule
  - `coordinator.scoutAndReview(tenant, ...)`：開頭 read active account、null 則拋 `Error("no active threads account; complete setup first")`；scout 寫入 review_item 時 `threads_account_id = account.id`
  - `agentDef.ts`：**不動**。原本 spec 寫的「移除對 kind in (...) 的讀寫呼叫」是基於錯誤的長表認知；實際 agent_def 是寬表、無 kind 欄位。`loadAgentDefFromFiles` 仍會被 Task 7（SetupWizard 新增第一個帳號時）當 md 預設值載入用

- [ ] **Step 1: reviewer.ts 接 active account**
  - `buildReviewerInstructions` 簽名加 `account: ThreadsAccount` 參數。
  - 內部組裝 4 段順序仍是 persona → owned_product → strategy → rule，但內容來源：
    - persona / marketing_strategy / content_writing_rule = `account.persona` / `.marketing_strategy` / `.content_writing_rule`
    - owned_product = 既有 `getAgentDef(tenant, "owned_product")` 仍走 agent_def 表
  - **絕對保持原文格式（markdown 區隔、區塊順序）不動**；不要因為改 source 就重排版。

- [ ] **Step 2: coordinator.ts 取 active account 後注入**
  - `scoutAndReview(tenant, ...)` 開頭：
    ```ts
    const account = getActiveAccount(tenant);
    if (!account) throw new Error("no active threads account; complete setup first");
    ```
  - 把 account 傳給 reviewer。
  - scout 階段寫入 `review_item.threads_account_id = account.id`。

- [ ] **Step 3: agentDef.ts 清理**
  - 若有對 `kind=persona/strategy/writing_rule` 的讀寫呼叫，全部砍掉（已搬到 threads_account 欄位）。
  - `kind=owned_product` 保留。

- [ ] **Step 4: typecheck + test**
  - 既有 reviewer.test.ts 若有就要更新 mock 加 account 參數；無就跳過。

---

### Task 4：poster per-account throttle + gate

**Files:**
- Modify: `src/backend/poster.ts`
- Modify: `src/backend/poster.test.ts`

**Interfaces:**

- **Consumes**:
  - Task 2: `getActiveAccountId(tenant)`, `getActiveAccount(tenant)`, `hasPreviewing(tenant, accountId)`, `sweepStalePreviews(tenant, accountId, timeoutMin)`, `getNextApproved(tenant, accountId)`
  - Task 5: `ResponseEnvelope.status` 可為 `"account_mismatch"`（本 task 程式碼會處理該值，但 enum 值由 Task 5 加入）
  - Task 5: `CommandSchema` 的 `post_reply` 接 `expectedHandle?: string`（本 task 在 enqueue 時帶上）
- **Produces**:
  - `startPoster(queue): { stop: () => void }` **簽名不變**；內部改 per-account：
    - `throttles: Map<string, SessionThrottle>`、`sentInSession: Map<string, number>`
    - tick 開頭讀 active；null 就 sleep 後 retry、不抓不 enqueue
    - dry-run 成功仍寫 `previewing`（Plan 10a 行為保留），實機路徑仍 `sent`（**不可動**）
    - `account_mismatch` response 視同 `element_not_found`：保留 `status=approved`、不增 sentInSession

- [ ] **Step 1: throttle / sentInSession 改 per-account**
  ```ts
  const throttles = new Map<string, SessionThrottle>();
  const sentInSession = new Map<string, number>();
  function getThrottle(accountId: string): SessionThrottle {
    let t = throttles.get(accountId);
    if (!t) {
      t = new SessionThrottle(1000, posterT.sessionHours, posterT.cooldownMinRange);
      throttles.set(accountId, t);
    }
    return t;
  }
  ```

- [ ] **Step 2: tick 開頭讀 active**
  ```ts
  const activeId = getActiveAccountId(TENANT);
  if (!activeId) { timer = setTimeout(tick, t.pollMs); return; }
  const swept = sweepStalePreviews(TENANT, activeId, t.previewTimeoutMin);
  if (swept > 0) console.log(`[poster] 清理 @${activeId} 超時 previewing ${swept} 筆`);
  if (hasPreviewing(TENANT, activeId)) { timer = setTimeout(tick, t.pollMs); return; }
  ```

- [ ] **Step 3: getNextApproved 加 accountId**
  ```ts
  const next = getNextApproved(TENANT, activeId);
  ```

- [ ] **Step 4: enqueue 帶 expectedHandle**
  ```ts
  const account = getActiveAccount(TENANT)!;
  const res = await queue.enqueue(TENANT, {
    action: "post_reply",
    postUrl: next.postUrl,
    draft: next.draft,
    dryRun: t.dryRun,
    reviewItemId: next.id,
    expectedHandle: account.handle,
  }, 90_000);
  ```

- [ ] **Step 5: 處理 account_mismatch**
  - `res.status === "account_mismatch"` 時 log 警告 + **保留 status=approved**（同 element_not_found 邏輯）。
  - sentInSession **不增加**。

- [ ] **Step 6: dry-run 成功仍照 Plan 10a 寫 previewing**
  - sentInSession.get(activeId) 用 throttle 計，全照原 Plan 10a 邏輯。

- [ ] **Step 7: 補測試**
  - 3 個新測試：
    1. active 為 null 時 tick 不抓不 enqueue
    2. 兩個 account 各自 throttle 隔離（切換不重置）— 用 mock + 計時驗
    3. account_mismatch response 時保留 status=approved
  - 既有 3 個 startPoster 測試（Plan 10a）更新 mock 加 `getActiveAccountId / getActiveAccount` stub。

- [ ] **Step 8: typecheck + test → ≥ 29 綠**

---

### Task 5：server endpoints + scout 加 expectedHandle + 收 poster TODO

**Files:**
- Modify: `src/backend/server.ts`
- Modify: `src/core/protocol.ts`
- Modify: `src/backend/poster.ts`（收掉 Task 4 留的 2 個 TODO）

**Interfaces:**

- **Consumes**: Task 2 全套 account CRUD + active selector helpers；Task 4 的 poster.ts（會收掉 ACCOUNT_MISMATCH local const + 補上 expectedHandle）
- **Produces**:
  - `CommandSchema` `scout` / `post_reply` 分支加 `expectedHandle: z.string().optional()`
  - `ResponseEnvelopeSchema` 的 `status` enum 加 `"account_mismatch"`
  - 後端 endpoint：
    - `GET    /api/v1/accounts` → `ThreadsAccount[]`
    - `POST   /api/v1/accounts` body `{ handle, display_name, persona, marketing_strategy?, content_writing_rule? }` → 201 `{id}`；handle 重複 / 空回 400
    - `DELETE /api/v1/accounts/:id` → 204；若刪到 active 則自動切到清單首個非刪除帳號或設 null
    - `GET    /api/v1/accounts/active` → `ThreadsAccount | null`
    - `PUT    /api/v1/accounts/active` body `{id}` → 200；若 `hasPreviewing(tenant, currentActive)` 為 true 回 409 + `{ error, previewing_count }`
  - 既有 `/scout` endpoint：從 active 拿 handle 塞 command 的 `expectedHandle`；active 為 null 回 400
  - 既有 `/reviews` 接 `?accountId=` query；缺省時用 active；用 in active 時的 review_item
  - **poster.ts 收尾**：
    - 移除 local `const ACCOUNT_MISMATCH = "account_mismatch";`，改用 protocol.ts 的 enum 值（直接字面值比對或 import 常數，視 Codex 判斷）
    - `enqueue` post_reply command 時帶入 `expectedHandle: getActiveAccount(TENANT)!.handle`（active 已 gate 過、保證非 null）
    - 移除兩處 `TODO(Plan 10c Task 5)` 註解

- [ ] **Step 1: protocol.ts 加 `expectedHandle` + `account_mismatch`**
  - CommandSchema scout / post_reply 分支加 `expectedHandle: z.string().optional()`
  - ResponseEnvelopeSchema status enum 加 `"account_mismatch"`

- [ ] **Step 2: 5 個 endpoint**
  ```
  GET    /api/v1/accounts                  → listThreadsAccounts(TENANT)
  POST   /api/v1/accounts                  → createThreadsAccount({ handle, display_name, persona, marketing_strategy?, content_writing_rule? })
  DELETE /api/v1/accounts/:id              → softDeleteThreadsAccount(id) + (若是 active 則自動切到清單首個非刪除帳號、或設 null)
  GET    /api/v1/accounts/active           → getActiveAccount(TENANT)
  PUT    /api/v1/accounts/active           → body {id}；若 hasPreviewing(TENANT, currentActive) 回 409；否則 setActiveAccountId
  ```
  - 所有寫操作驗：handle 不能空、不能跟既有重複（同 tenant 內 unique check）、display_name 不能空

- [ ] **Step 3: 既有 `/scout` endpoint 改造**
  - 從 active account 拿 handle、塞進 scout command 的 `expectedHandle`
  - 若 active 為 null → 400 「請先設定 active 帳號」

- [ ] **Step 4: 既有 `/reviews` 加 accountId filter**
  - `GET /reviews?tenant=us` → 改為 `GET /reviews?tenant=us&accountId=xxx`；accountId 缺省時用 active；用於 ReviewQueue UI

- [ ] **Step 5: typecheck pass**

---

### Task 6：content.ts 登入身份檢查 + SW forward

**Files:**
- Modify: `entrypoints/content.ts`
- Modify: `entrypoints/background.ts`

**Interfaces:**

- **Consumes**:
  - Task 5: `CommandSchema` 已含 `expectedHandle?: string`、`ResponseEnvelope.status` 已含 `"account_mismatch"`
- **Produces**:
  - `content.ts`：
    - `getCurrentThreadsHandle(): Promise<string | null>`（讀 DOM、3 fallback selector、3 秒 retry、最終 null = unknown）
    - `scout(...)` 與 `postReply(...)` 在 `expectedHandle` 存在時先呼叫 `getCurrentThreadsHandle()` 比對；不符或回 null（**fail-safe**）即不執行任何 DOM 動作，回 `{ ok:false, error: "mismatch:actual=X, expected=Y" }`
  - `background.ts`：
    - `PolledCommand.command` 加 `expectedHandle?: string`
    - `handlePostReply` / scout 路由把 `expectedHandle` 原樣 forward 給 content
    - content 回 `error.startsWith("mismatch:")` 時，SW 包成 `{ status: "account_mismatch", error }` 回後端（而非預設的 `"fail"`）

- [ ] **Step 1: content.ts 新增 `getCurrentThreadsHandle()`**
  - 嘗試 3 個 selector（fallback chain）：
    1. `a[role="link"][aria-label*="Profile" i]` 取 href `/@xxx`
    2. `nav a[href^="/@"][aria-current="page"]`（profile 頁面狀況）
    3. `header img[alt^="@"]` 的 alt 文字
  - 三個都失敗回 `null`
  - 處理函式做 retry：每 500ms 重試一次、最多 3 秒；仍無就返回 null
  - 純讀 DOM、無副作用

- [ ] **Step 2: scout / postReply 在執行前比對**
  - 若 `command.expectedHandle` 存在：
    - `actual = await getCurrentThreadsHandle()`
    - 若 `actual == null || actual.toLowerCase() !== expectedHandle.toLowerCase()`：
      - **不執行任何 DOM 動作**
      - 回 `{ ok: false, error: \`mismatch: actual=${actual ?? "unknown"}, expected=${expectedHandle}\` }`
    - SW 端把這個 fail 映射成 `status: "account_mismatch"` 包進 response envelope（**新邏輯，下一步處理**）

- [ ] **Step 3: SW background.ts handle account_mismatch**
  - `handlePostReply` 收到 content 回 `{ok:false, error:"mismatch:..."}` → `postResult({ ..., status: "account_mismatch", error })`
  - scout 同理
  - PolledCommand type 加 `expectedHandle?: string`，scout / post_reply 路由都把它原樣 forward 給 content

- [ ] **Step 4: typecheck + ext:build**

---

### Task 7：SetupWizard 擴充 + AccountsView + AccountSwitcher

**Files:**
- Modify: `entrypoints/sidepanel/api.ts`
- Modify: `entrypoints/sidepanel/SetupWizard.tsx`
- Create: `entrypoints/sidepanel/AccountsView.tsx`
- Create: `entrypoints/sidepanel/components/AccountSwitcher.tsx`
- Modify: `entrypoints/sidepanel/App.tsx`

**Interfaces:**

- **Consumes**: Task 5 的 5 個 endpoint；既有 Card / Button / StatusChip / TextArea / icons 元件
- **Produces**:
  - `api.ts` 新 helper：
    - `listAccounts(): Promise<ThreadsAccount[]>`
    - `createAccount(input): Promise<{id: string}>`
    - `deleteAccount(id: string): Promise<void>`
    - `getActiveAccount(): Promise<ThreadsAccount | null>`
    - `setActiveAccount(id: string): Promise<void>`（處理 409 → throw `PreviewingBlockError`）
  - `SetupWizard.tsx`：原 step（tenant brand_name + owned_product）後加一步「新增第一個 threads_account」（handle / display_name / persona 必填、strategy/rule textarea 預設空），提交呼叫 `createAccount` + `setActiveAccount(newId)` 才算完成 onboarding
  - `AccountsView.tsx` 元件：列表 + 新增表單 + 切 active + 軟刪；切 active 收 409 時跳對話框
  - `components/AccountSwitcher.tsx`：Header 用的 dropdown，顯示「@active_handle ▼」、列其他帳號、最後一項「+ 新增帳號」（跳 AccountsView）
  - `App.tsx`：Header 嵌入 `AccountSwitcher`；nav 加 AccountsView entry；若 SetupWizard 已完成但 `listAccounts()` 空則強制跳「新增第一個帳號」

- [ ] **Step 1: api.ts 加 5 個 helper**
  - `listAccounts() / createAccount(input) / deleteAccount(id) / getActiveAccount() / setActiveAccount(id)`
  - setActiveAccount 處理 409（hasPreviewing）回 user-friendly error

- [ ] **Step 2: SetupWizard 加 step**
  - 既有 step：tenant brand_name → owned_product
  - 新加 step：「新增第一個 Threads 帳號」表單（handle + display_name + persona 必填、strategy/rule textarea 可空）
  - 提交呼叫 `createAccount` → `setActiveAccount(newId)` → 完成 onboarding

- [ ] **Step 3: 新 AccountsView.tsx**
  - 列當前 tenant 所有非軟刪 accounts、用既有 Card / StatusChip 元件
  - 每張卡：handle / display_name / 「設為 active」按鈕（active 時 disabled + 標示）/「軟刪除」（active 不能刪、要先切走）
  - 頂部「+ 新增帳號」展開既有 SetupWizard step 3 那個表單
  - 切換 active 時呼叫 `setActiveAccount`，409 時跳對話框「@當前 active 有 1 筆預覽中，請先 resolve」

- [ ] **Step 4: AccountSwitcher 元件**
  - Header 用的小 dropdown：顯示「@active_handle ▼」、點開列其他帳號、最後一項是「+ 新增帳號」（跳 AccountsView）
  - 切換時樂觀更新本地、後端 409 時 revert + 顯示提示

- [ ] **Step 5: App.tsx 整合**
  - Header 左側放 AccountSwitcher（在 brand 名稱旁邊或下方）
  - nav 加 AccountsView entry（icon 選 Users 或 SwitchAccount）
  - SetupWizard 已完成、但 `listAccounts()` 為空時強制跳「新增第一個帳號」step

- [ ] **Step 6: ext:build pass**

---

### Task 8：KnowledgeView tabs + ReviewQueue / ScoutView 適配 + AlertBar

**Files:**
- Modify: `entrypoints/sidepanel/KnowledgeView.tsx`
- Modify: `entrypoints/sidepanel/ReviewQueue.tsx`
- Modify: `entrypoints/sidepanel/ScoutView.tsx`
- Modify: `entrypoints/sidepanel/components/AlertBar.tsx`
- Modify: `entrypoints/sidepanel/components/StatusChip.tsx`

**Interfaces:**

- **Consumes**:
  - Task 7: `api.listAccounts`, `api.getActiveAccount`, `api.setActiveAccount`、AccountSwitcher 已在 Header
  - Task 5: `/reviews?accountId=` query 已支援
- **Produces**:
  - `KnowledgeView.tsx`：頂部 tabs ─「品牌資訊」（編 owned_product，沿用既有 `setAgentDef`）+ 每個 account 一個 tab「@handle」（3 個 textarea：persona / strategy / rule，存呼叫 `api.updateAccount`）；tab state 純 local UI、不寫 DB
  - `ReviewQueue.tsx`：`fetchReviews()` 帶當前 active.id；只顯示該帳號的 review_item；卡片頂部加「@active_handle」chip；active 為 null 顯示 empty state
  - `ScoutView.tsx`：拿掉任何「選海巡帳號」UI（如有）；觸發前 check active != null；顯示「以 @active_handle 身份海巡」說明
  - `AlertBar.tsx`：加 `tone="account-mismatch"`（橘/紅 warning 樣式）+ 文案「Threads 分頁登入 @actual、active 是 @expected，請切換」
  - ReviewQueue / ScoutView：local state 記錄最近一次 scout/post_reply 是否回 `account_mismatch`，是則於頂部顯示 `<AlertBar tone="account-mismatch" />`；下一次成功操作清掉
  - `StatusChip.tsx`：加 `account_mismatch` label「帳號不符」+ tone `danger`

- [ ] **Step 1: KnowledgeView 加 tabs**
  - 頂部 tabs：「品牌資訊」（owned_product，沿用既有 agent_def 編輯 UI）+ 每個非軟刪 account 一個 tab「@handle」
  - 切到品牌 tab：textarea 編 owned_product（既有），存 → 既有 `setAgentDef`
  - 切到 account tab：3 個 textarea（persona / strategy / rule），存 → 新 API `updateAccount(id, {...})`
  - tab state local，不寫進 tenant_config（編輯介面、不影響行為）

- [ ] **Step 2: ReviewQueue 適配 active**
  - `fetchReviews()` 傳當前 active.id；list 只顯示該 account 的
  - 卡片頂部加 chip「@active_handle」（讓使用者確認）
  - 若 `getActiveAccount()` 返回 null：顯示 empty state「請先新增並選擇一個帳號」

- [ ] **Step 3: ScoutView 適配**
  - 拿掉「選擇海巡帳號」UI（如果有）
  - 觸發海巡前 check `getActiveAccount()` != null
  - 「目前以 @active_handle 身份海巡」說明一行

- [ ] **Step 4: AlertBar 新增 account-mismatch tone**
  - 加一個 prop `tone="account-mismatch"`（橘 / 紅色）
  - 訊息：`Threads 分頁登入是 @${actual}、active 帳號是 @${expected}，請在 Threads 切換到正確帳號`
  - **顯示時機**：ReviewQueue / ScoutView 在最近一次 scout/post_reply 後端回 `account_mismatch` status 時、頂部固定顯示，使用者切換帳號或下一次 scout 成功才消失
  - 訊息來源：拉 `/reviews` 時若該 tenant 有 review_item.last_status='account_mismatch'（簡化：直接讓 `/api/v1/account-mismatch-banner` 回最近一次 — **超出範圍，先用 local state 在前端記錄最近一次 fail，下次成功就清掉**）

- [ ] **Step 5: StatusChip 加 `account_mismatch` label「帳號不符」**（tone=danger）

- [ ] **Step 6: ext:build pass**

---

### Task 9：測試補齊 + handoff 更新

**Files:**
- Modify: `src/backend/poster.test.ts`
- Create: `src/backend/storeMigration.test.ts`（可選）
- Modify: `.handoff/session.md`

**Interfaces:**

- **Consumes**: Task 1–8 全部 Produces
- **Produces**:
  - `storeMigration.test.ts`（可選）：(1) 既有 install 跑 migration → default account 建立 + persona 搬入 + agent_def 刪除；(2) 重跑同份 migration → no-op
  - `poster.test.ts`：確保 Task 4 新增的 3 個測試與既有 Plan 10a 3 個測試（mock 更新後）皆綠
  - `.handoff/session.md`：Progress、Key Decisions、Key Files、e2e 步驟更新到 Plan 10c 完成版

- [ ] **Step 1: storeMigration 測試**
  - 用 mock DB 驗：
    1. 既有 install（有 agent_def kind=persona）跑 migration → 建 default account + persona 搬過來 + agent_def 刪掉
    2. 重跑同樣的 migration → idempotent，no-op
  - 用 better-sqlite3 in-memory `:memory:` 跑、不污染檔案

- [ ] **Step 2: poster 測試補齊**（接續 Task 4 Step 7）
  - 確認 3 個新測試 + 既有 6 個全綠

- [ ] **Step 3: handoff/session.md 更新**
  - Progress 加 `- [x] Plan 10c 多 Threads 帳號 + 登入身份檢查`
  - Key Decisions 加：
    - 「user ≈ tenant ≈ brand 合併（市場 A），多帳號用 active 全域 state」
    - 「agent_def 拆解：owned_product per tenant、persona/strategy/rule per threads_account（C 方案）」
    - 「Threads 分頁登入身份硬擋：command 帶 expectedHandle、content 比對、不符回 account_mismatch」
    - 「Plan 10b（雲端 + user 層）：tenant 抽象維持隱形，user 層才會浮現」
  - Key Files 更新 store / poster / coordinator / reviewer 描述
  - e2e 步驟擴充：
    1. 既有 Plan 10a 預覽流程仍跑得通
    2. 新增第二個 threads account、切換 → ReviewQueue / KnowledgeView 都 follow
    3. 故意把 Threads 分頁切到別的帳號 → 觸發海巡 → 後端回 account_mismatch → 側欄出橘色 banner
    4. 切回正確帳號 → 重新海巡成功 → banner 消失

- [ ] **Step 4: 最終 validation**
  - `npm run typecheck` ✅
  - `npm test` ≥ 29 綠
  - `npm run ext:build` ✅

---

## Validation

- [ ] `npm run typecheck` exit 0
- [ ] `npm test` ≥ 29 綠（原 26 + 新 ~3–5）
- [ ] `npm run ext:build` 成功
- [ ] 人工 e2e（Task 9 Step 3 列的 4 個情境）

---

## Out of Scope (明確不做)

- 註冊 / 登入 / token auth（Plan 10b）
- 多 user / lock / assignment / soft-presence（Plan 11+）
- tenant 切換 UI（隱形）
- 雲端 backend / Postgres migration（Plan 10b）
- audit log / 操作記錄（Plan 10b）
- per-account quota / 計費（Plan 11+）
- Threads 帳號自動登入 / cookie 注入（永遠不做）
- 跨帳號的 review_item 重新 assign / 移轉
- 帳號數量 hard cap（軟性建議 5 以下，UI 不擋）

---

## 設計決策對應 (給未來改動者)

| 決策 | 為什麼 |
|---|---|
| user ≈ tenant ≈ brand 合併 | 市場 A 假設：1 個 install 1 個 operator，不需要多 user 抽象 |
| agent_def C 方案（owned_product per tenant、persona/strategy/rule per account） | 真實場景：同品牌可有多人格（主帳 vs 員工人格），但品牌資訊不該重複 |
| active 是全域單值、不是 per-user-session | 市場 A 只有 1 user，per-user 多餘；Plan 11 才升級 |
| Threads 分頁登入身份硬擋 | 避免 A 操作 B 的誤觸；selector 失效時保守不執行（fail-safe） |
| Migration runtime 不寫 SQL 遷移檔 | 沿用既有「idempotent boot-time migration」pattern（D17/Plan 10a 一致） |
| 不加帳號數量 cap | YAGNI；真有人塞 50 個再加 |
| 軟刪除而非硬刪 | 保留 review_item 歷史的審計線索 |
