# Plan 10a：dry-run 人工確認閘（修補 poster 衝刷分頁問題）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dry-run 模式下，poster 把草稿填進 Threads 編輯器後 **不再自動把 status 改 sent**，而是把該筆改為新狀態 `previewing` 並停止往下挑下一篇；使用者必須在側欄按「確認送出」或「不發了」之後，poster loop 才會依正常 cooldown 取下一筆 approved 進入下一次 dry-run。同時補一個保險：content script 嘗試偵測使用者已在 Threads 親手送出 → 自動 resolve 為 sent。

**Why this matters:** 目前 dry-run 路徑（[poster.ts:44-47](../../../src/backend/poster.ts#L44)）填完草稿就 `status=sent`、tick 繼續，4–11 分鐘後**強制把行銷負責人的 Threads 分頁切走**到下一篇貼文 — 沒給人類任何處理時間。這違反 dry-run 的 human-in-the-loop 設計初衷，正式上線（含過渡期內部試用）阻擋級必修。

**Architecture:**
- **新增狀態 `previewing`**：介於 `approved` 與 `sent` 之間。poster 在 dry-run 路徑寫入 `previewing` 而非 `sent`。
- **poster loop 守門**：每個 tick 先 check `hasPreviewing(tenant)`，若有則只 sleep + 不抓下一筆。`getNextApproved` 不需動。
- **`/api/v1/preview/resolve` endpoint**：接 `{id, action: "sent" | "skipped"}` → `updateReviewItem`。是後端唯一推進狀態的入口。
- **側欄 ReviewQueue 升級**：item.status === "previewing" 時顯示橘色 chip「預覽中」+ 兩顆 primary/danger 按鈕「我已送出」「不發了」；按下後呼叫 resolve endpoint，列表自動 refetch（4 秒既有節奏 + 立即樂觀更新）。
- **content script 自動偵測（best-effort）**：dry-run 路徑填完草稿後啟動 poller（每 1.5s）：若編輯器 textContent 變空 → 視為使用者送出 → 透過 SW 呼叫 resolve(sent)；若使用者離開該 postUrl 5 秒以上 → 不動作（保守，讓使用者用側欄按鈕）。偵測失敗也無妨，使用者仍可用側欄按鈕。
- **`previewing` 超時清掃**：poster tick 順手 sweep — `previewing` 超過 `POSTER_PREVIEW_TIMEOUT_MIN`（預設 15 min）→ 標 `skipped` + log。
- **`/api/v1/` 前綴新增**：本 plan 開始把新 endpoint 放在 `/api/v1/`；舊 endpoint 暫不動（向下相容），下個 plan 統一遷移。**這是 SaaS 過渡期架構衛生**。

**Tech Stack:** 既有 — Node http + better-sqlite3、WXT content script、React + Tailwind v4、TypeScript。

**範圍邊界（YAGNI）：**
- 只動 dry-run 路徑。`POSTER_DRY_RUN=0`（實機）路徑**不動**：實機本來就直接送出 + status=sent，沒有「等使用者確認」的概念。
- 不做進度條 / 倒數計時器 / preview 中重新編輯草稿 UI。
- 不做「批次預覽」、「平行預覽」、「重新觸發 dry-run」。
- 不做 audit log / 操作記錄（Plan 10b 範圍）。
- `previewing` 狀態目前**不算 sentInSession**（session cap 只算真的 resolve 為 sent 的）。
- 多租戶仍 hardcode `"us"`（D17 維持）；但 `validateToken()` interface 預留 — 不在本 plan，下個 plan 做。

**驗證慣例：** typecheck + 23+ 測試綠（新增 2–3 個 poster.test.ts 邏輯測試）+ ext:build；人工 e2e 由使用者跑。

---

## File Structure

- `src/backend/store.ts` — **Modify**：加 `hasPreviewing(tenant)`、`sweepStalePreviews(tenant, timeoutMin)`、`getReviewItem(id)`（resolve 端點要查 tenant 歸屬）。`updateReviewItem` 的 status 欄位接受 `previewing` 字串即可（schema TEXT，無需 migration）。
- `src/backend/poster.ts` — **Modify**：
  1. tick 開頭先 `hasPreviewing(TENANT)` → true 則 `setTimeout(tick, pollMs)` 直接返回（不消耗節流、不抓 approved）。
  2. dry-run 分支：`enqueue` 成功後 `updateReviewItem(next.id, { status: "previewing", previewing_at: now })` 改為 `previewing`（不再 sent）。
  3. tick 結尾或開頭順手 `sweepStalePreviews(TENANT, t.previewTimeoutMin)`。
- `src/backend/posterTuning.ts` — **Modify**：加 `previewTimeoutMin`（env `POSTER_PREVIEW_TIMEOUT_MIN`，預設 60）。
- `src/backend/server.ts` — **Modify**：加 `POST /api/v1/preview/resolve`。Body `{id: string, action: "sent" | "skipped"}`，內部呼叫 `updateReviewItem(id, { status: action })`；item.status !== "previewing" 時回 409。
- `src/core/protocol.ts` — **Modify**：（可選）若 ReviewItem 共用 schema，加 `"previewing"` 進 status enum。檢查現況決定。
- `entrypoints/sidepanel/components/StatusChip.tsx` — **Modify**：加 `previewing` 對應的 label「預覽中」+ tone（建議 `warning` 橘色）。
- `entrypoints/sidepanel/ReviewQueue.tsx` — **Modify**：item.status === "previewing" 時渲染兩顆動作按鈕（呼叫 `api.previewResolve(id, action)`），按下後樂觀更新本地狀態 + invalidate refetch。「核准」「跳過」按鈕在 previewing 狀態下隱藏。
- `entrypoints/sidepanel/api.ts` — **Modify**：加 `previewResolve(id, action)` → POST `/api/v1/preview/resolve`。
- `entrypoints/content.ts` — **Modify**：dry-run 填完草稿後啟動 poller：若 editor.textContent 變空（或 editor 元素消失）且當前 location.href 仍為 postUrl → 透過 `chrome.runtime.sendMessage({type:"preview_auto_sent", id})`。新增 `preview_auto_sent` SW 路由 → 後端 `/api/v1/preview/resolve`。失敗安靜（使用者仍可手按）。
- `entrypoints/background.ts` — **Modify**：加 `preview_auto_sent` listener → POST `/api/v1/preview/resolve {id, action:"sent"}`。
- `src/backend/poster.test.ts` — **Modify**：加測試：has previewing 時不抓下一筆；dry-run 路徑寫 previewing 而非 sent；sweep timeout 行為。
- `.env.example` — **Modify**：列 `POSTER_PREVIEW_TIMEOUT_MIN`。

---

## Tasks

### Task 1：store 層加 `previewing` 支援與輔助函式

**Files:**
- Modify: `src/backend/store.ts`

- [ ] **Step 1: 加 `previewing_at` 欄位**
  - 在 `review_item` CREATE TABLE 後加 `ALTER TABLE review_item ADD COLUMN previewing_at TEXT;` 的 idempotent migration（try/catch 吞「duplicate column」錯誤 — 沿用既有 migration 風格，無則新增）。
  - `updateReviewItem` 接受可選 `previewing_at`。

- [ ] **Step 2: 加 `hasPreviewing(tenant: string): boolean`**
  - `SELECT 1 FROM review_item WHERE tenant_id = ? AND status = 'previewing' LIMIT 1`。

- [ ] **Step 3: 加 `sweepStalePreviews(tenant: string, timeoutMin: number): number`**
  - `UPDATE review_item SET status='skipped' WHERE tenant_id=? AND status='previewing' AND previewing_at < ?`（cutoff = now - timeoutMin 分鐘 ISO 字串）。
  - 回傳 changes 數，給 poster log。

- [ ] **Step 4: 加 `getReviewItem(id: string): {id, tenant_id, status, postUrl, draft} | null`**
  - resolve endpoint 用來驗 tenant 歸屬 + 防呆（status 不對時回 409）。

- [ ] **Step 5: typecheck + test**
  - `npm run typecheck && npm test` → 既有 23 測試綠。

---

### Task 2：posterTuning 加 timeout

**Files:**
- Modify: `src/backend/posterTuning.ts`
- Modify: `.env.example`

- [ ] **Step 1**：加 `previewTimeoutMin: number(process.env.POSTER_PREVIEW_TIMEOUT_MIN ?? "15")`。
- [ ] **Step 2**：`.env.example` 補一行範例 + 註解。

---

### Task 3：poster.ts dry-run 路徑改寫

**Files:**
- Modify: `src/backend/poster.ts`

- [ ] **Step 1: tick 開頭加守門**
  ```ts
  // sweep + 守門必須早於抓 approved
  const swept = sweepStalePreviews(TENANT, t.previewTimeoutMin);
  if (swept > 0) console.log(`[poster] 清理超時 previewing ${swept} 筆`);
  if (hasPreviewing(TENANT)) {
    timer = setTimeout(tick, t.pollMs);
    return;
  }
  ```

- [ ] **Step 2: dry-run 分支寫 previewing**
  ```ts
  if (res.status === "ok") {
    if (t.dryRun) {
      updateReviewItem(next.id, { status: "previewing", previewing_at: new Date().toISOString() });
      console.log(`[poster] 🔍 dry-run 草稿已填入 id=${next.id}，等待人工確認（timeout=${t.previewTimeoutMin}min，預設 15min）`);
      // 注意：不增加 sentInSession，等使用者 resolve 為 sent 時再算
    } else {
      updateReviewItem(next.id, { status: "sent" });
      sentInSession += 1;
      console.log(`[poster] ✅ 已發送 id=${next.id}（本 session ${sentInSession}/${t.maxPerSession}）`);
    }
  }
  ```

- [ ] **Step 3: typecheck + test（測試會壞，下一個 task 修）**

---

### Task 4：poster.test.ts 加 3 個測試

**Files:**
- Modify: `src/backend/poster.test.ts`

- [ ] **測試 1**：`hasPreviewing` 為 true 時 tick 不呼叫 `getNextApproved`、不呼叫 `enqueue`。
- [ ] **測試 2**：dry-run 路徑 + enqueue ok → 呼叫 `updateReviewItem` 帶 `status: "previewing"`，**不**帶 `sent`。
- [ ] **測試 3**：實機路徑（dryRun=false）+ enqueue ok → 呼叫 `updateReviewItem` 帶 `status: "sent"`。

（沿用既有 poster.test.ts 的 mock 風格；hasPreviewing / sweepStalePreviews 用 stub）

- [ ] **Run**：`npm run typecheck && npm test` → 25/25 綠。

---

### Task 5：後端 `/api/v1/preview/resolve` endpoint

**Files:**
- Modify: `src/backend/server.ts`

- [ ] **Step 1: 加路由**
  ```ts
  // POST /api/v1/preview/resolve  body: {id: string, action: "sent" | "skipped"}
  if (req.method === "POST" && req.url === "/api/v1/preview/resolve") {
    const body = await readJson(req);
    const action = body.action === "sent" || body.action === "skipped" ? body.action : null;
    if (!body.id || !action) return send(res, 400, { error: "bad request" });
    const item = getReviewItem(body.id);
    if (!item) return send(res, 404, { error: "not found" });
    if (item.tenant_id !== TENANT) return send(res, 403, { error: "forbidden" });
    if (item.status !== "previewing") return send(res, 409, { error: `status=${item.status}, not previewing` });
    updateReviewItem(body.id, { status: action });
    console.log(`[server] preview 解決 id=${body.id} → ${action}`);
    return send(res, 200, { ok: true });
  }
  ```

- [ ] **Step 2**：typecheck pass。

---

### Task 6：StatusChip + ReviewQueue UI

**Files:**
- Modify: `entrypoints/sidepanel/components/StatusChip.tsx`
- Modify: `entrypoints/sidepanel/ReviewQueue.tsx`
- Modify: `entrypoints/sidepanel/api.ts`

- [ ] **Step 1: StatusChip 加 `previewing` 狀態**
  - 加入 type union、`statusTone.previewing = "warning"`、`labels.previewing = "預覽中"`。

- [ ] **Step 2: api.ts 加 `previewResolve`**
  ```ts
  export async function previewResolve(id: string, action: "sent" | "skipped") {
    return fetch(`${API_BASE}/api/v1/preview/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    }).then(r => r.json());
  }
  ```

- [ ] **Step 3: ReviewQueue 條件渲染**
  - item.status === "previewing" 時：
    - 顯示 StatusChip status="previewing"
    - 卡片上方加一條淡橘色提示條：「草稿已填入 Threads 編輯器，請至該分頁確認後選擇：」
    - 顯示兩顆按鈕：「確認送出」（primary/success tone）→ `previewResolve(id, "sent")`、「取消發送」（subtle/danger tone）→ `previewResolve(id, "skipped")`
    - 既有「核准」「跳過」按鈕在此狀態下**不渲染**
    - 點完按鈕：樂觀更新 item.status 為對應值（4s polling 會再對齊）

- [ ] **Step 4**：`npm run ext:build` 成功。

---

### Task 7：content.ts dry-run 自動偵測（best-effort）

**Files:**
- Modify: `entrypoints/content.ts`
- Modify: `entrypoints/background.ts`

- [ ] **Step 1: content.ts dry-run 分支 — 啟動 editor 偵測 poller**
  - 既有 dry-run path（[content.ts:205-208](../../../entrypoints/content.ts#L205)）改為：
    - 印 dry-run log 後**不立刻 return**，啟動 poller（傳入 reviewItemId — 但目前 `post_reply` command 沒帶 id；需要在 protocol 加上 `reviewItemId?: string` 並從 poster 傳）
    - 在 SW 端 enqueue 時把 `next.id` 一併傳入 post_reply command
    - poller 每 1.5s 檢查 editor textContent；空 + location.href 仍為 postUrl + 經過 ≥ 5s（防止剛 insertText 就誤判）→ 視為「使用者送出」，sendMessage 給 SW
    - 30 分鐘超時就放棄（不動作，依賴使用者用側欄按鈕）
    - dry-run 的 enqueue ack **仍立刻回 ok**（poster 不等 poller，否則 timeout 90s 會爆）；poller 是離線的後台行為

- [ ] **Step 2: 在 `Command` schema 加 `reviewItemId?: string`**（`src/core/protocol.ts`）
  - poster.ts 呼叫 enqueue 時帶上 `next.id`

- [ ] **Step 3: background.ts 加 `preview_auto_sent` listener**
  - 收到 `{type:"preview_auto_sent", id}` → POST 後端 `/api/v1/preview/resolve {id, action:"sent"}`
  - 失敗安靜（log warn 即可）

- [ ] **Step 4**：typecheck + test 全綠 + ext:build。

---

### Task 8：人工 e2e 驗證指引（補 README / .handoff）

**Files:**
- Modify: `.handoff/session.md`

- [ ] **更新 Progress / Pending Questions / e2e 步驟**：
  - Plan 10a 完成的部分打勾
  - 新 e2e 步驟（取代 session.md 原本第 66-71 行的 Plan 9 e2e）：
    1. `npm run backend`、海巡核准 2–3 篇
    2. 等 4–11 分鐘 → 分頁被導去第一篇、草稿填入；**不會再繼續切走第二篇**
    3. 側欄看到該 item 狀態變「預覽中」+ 兩顆按鈕
    4. 親手在 Threads 按送出 → 等 ≤ 3 秒 → 側欄狀態自動變「已送出」（auto-detect 路徑生效）
    5. 或：手動按側欄「我已送出」/「不發了」→ 同樣推進
    6. 推進後等下一次 cooldown → 第二篇被切過去 → 重複

---

## Validation

- [ ] `npm run typecheck` exit 0
- [ ] `npm test` ≥ 25 綠（原 23 + Task 4 新增 2–3）
- [ ] `npm run ext:build` 成功
- [ ] 人工 e2e（Task 8）至少跑一次 dry-run 全流程：核准 2 篇 → 第一篇 previewing → resolve → cooldown → 第二篇 previewing

---

## Out of Scope（明確不做）

- Audit log / 誰按了哪顆按鈕（Plan 10b）
- 雲端部署 / token auth / OpenAI key 集中（Plan 10b）
- preview 中重新編輯草稿 / 重抓 LLM
- preview 倒數計時器 UI（timeout 在後端跑，UI 不顯示）
- 多 preview 排隊預覽 / 平行 preview
- 真·多租戶（D17 維持 hardcode `"us"`）
