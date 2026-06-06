# Plan 4b: SQLite 持久化 + 去重 + refill 到足量 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。
>
> **執行紀律（使用者偏好）**：速度優先、不 over-design、只做必要功能、不寫前期 unit test（驗證靠手動 e2e + typecheck），測試後補。

**Goal:** 解決「撈回候選但相關數不足、不會回頭補」的痛——後端 scout→LLM 篩→**相關不足量就再 scout（跳過已處理的、往下捲找新貼文）**，直到湊滿目標相關數 / 達輪數上限 / 無新貼文。同時把儲存從 JSON 升級到 SQLite（review_item + processed_id），作為 Plan 5 審核台的權威來源。

**Architecture:** 沿用 Plan 2/3/4a。新增 `backend/store`（better-sqlite3）、`backend/coordinator`（refill 迴圈）。scout 指令新增 `excludeIds`，content script 用它跳過已處理貼文往下捲。orchestrator 改成持久化到 SQLite。

**Tech Stack:** `better-sqlite3@^11`（已安裝）、既有 Plan 4a 鏈路。

**決策**（已確認）：第一刀=持久化+去重+refill；refill 終止=達標/達輪數上限/無新貼文任一；review_item 存 SQLite（review-queue.json 改為非權威 dev 鏡像）；tenant_config + rule 檢查延後 Plan 4c。

參考 spec §6（資料模型）、§8（海巡）、§11 里程碑3。

---

### Task 1: backend/store — SQLite（review_item + processed_id）

**Files:** Create `src/backend/store.ts`

- [ ] **Step 1: 建 `src/backend/store.ts`**
```ts
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

let db: Database.Database | null = null;

/** 取得 SQLite 連線（singleton），首次建表。 */
export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync("data", { recursive: true });
  db = new Database(process.env.DB_FILE ?? "data/agent-mkt.db");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_item (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      post_id TEXT NOT NULL,
      post_json TEXT NOT NULL,
      relevant INTEGER NOT NULL,
      reason TEXT,
      draft TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed_id (
      tenant_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      scouted_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, post_id)
    );
  `);
  return db;
}

export interface ReviewItemRow {
  id: string;
  tenant_id: string;
  kind: string;
  post_id: string;
  post_json: string;
  relevant: number;
  reason: string;
  draft: string;
  status: string;
  created_at: string;
}

export function saveReviewItem(row: ReviewItemRow): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO review_item
       (id, tenant_id, kind, post_id, post_json, relevant, reason, draft, status, created_at)
       VALUES (@id, @tenant_id, @kind, @post_id, @post_json, @relevant, @reason, @draft, @status, @created_at)`,
    )
    .run(row);
}

/** 標記一批貼文已處理（去重用）。 */
export function markProcessed(tenant: string, ids: string[]): void {
  const d = getDb();
  const stmt = d.prepare(`INSERT OR IGNORE INTO processed_id (tenant_id, post_id, scouted_at) VALUES (?, ?, ?)`);
  const now = new Date().toISOString();
  const tx = d.transaction((arr: string[]) => {
    for (const id of arr) stmt.run(tenant, id, now);
  });
  tx(ids);
}

/** 取某租戶所有已處理的 post_id。 */
export function getProcessedIds(tenant: string): string[] {
  const rows = getDb().prepare(`SELECT post_id FROM processed_id WHERE tenant_id = ?`).all(tenant) as Array<{
    post_id: string;
  }>;
  return rows.map((r) => r.post_id);
}
```

- [ ] **Step 2: 手動 smoke + typecheck**

Run: `npm run typecheck`，再:
```bash
node --import tsx/esm -e "import('./src/backend/store.ts').then(m => { m.markProcessed('us', ['a','b']); console.log('processed:', m.getProcessedIds('us')); })"
```
Expected: typecheck 乾淨；印 `processed: [ 'a', 'b' ]`。之後刪測試殘留：`rm -f data/agent-mkt.db data/agent-mkt.db-wal data/agent-mkt.db-shm`。

- [ ] **Step 3: Commit**
```bash
git add src/backend/store.ts
git commit -m "feat(backend): SQLite store (review_item + processed_id)"
```

---

### Task 2: protocol — scout 指令加 excludeIds

**Files:** Modify `src/core/protocol.ts`

- [ ] **Step 1: scout 變體加 `excludeIds`**
把 scout 的 `z.object` 改為（在 budget 後加一行）：
```ts
  z.object({
    action: z.literal("scout"),
    keyword: z.string(),
    serpType: z.enum(["default", "recent"]).optional(),
    criteria: ScoutCriteriaSchema.partial().optional(),
    budget: ScoutBudgetSchema.partial().optional(),
    excludeIds: z.array(z.string()).optional(), // 已處理貼文 id，content script 跳過
  }),
```

- [ ] **Step 2: typecheck + test**

Run: `npm run typecheck && npm test`
Expected: 乾淨；21 測試綠。

- [ ] **Step 3: Commit**
```bash
git add src/core/protocol.ts
git commit -m "feat(core): scout command carries excludeIds (dedup for refill)"
```

---

### Task 3: content script — scout 跳過 excludeIds

**Files:** Modify `entrypoints/content.ts`

- [ ] **Step 1: onMessage 傳入 excludeIds**
把 `scout(...)` 呼叫改為帶第 4 參數：
```ts
        scout(
          msg.keyword as string,
          msg.criteria as Partial<ScoutCriteria> | undefined,
          msg.budget as Partial<ScoutBudget> | undefined,
          (msg.excludeIds as string[] | undefined) ?? [],
        )
```

- [ ] **Step 2: scout 簽章 + 種入 seen**
把 `scout` 簽章加上 `excludeIds`，並在建立 `seen` 時種入：
```ts
async function scout(
  keyword: string,
  criteria?: Partial<ScoutCriteria>,
  b?: Partial<ScoutBudget>,
  excludeIds: string[] = [],
): Promise<{ candidates: ScoutCandidate[]; health: { scanned: number; withText: number; withLikeBtn: number } }> {
```
並把原本的 `const seen = new Set<string>();` 改為：
```ts
  const seen = new Set<string>(excludeIds);
```
（其餘抓取/篩選/budget 邏輯不變——已在 seen 裡的 id 會在迴圈 `if (!id || seen.has(id)) continue;` 被跳過，捲動會自然往下找新貼文。）

- [ ] **Step 3: 建置 + typecheck**

Run: `npm run ext:build && npm run typecheck`
Expected: 成功、乾淨。

- [ ] **Step 4: Commit**
```bash
git add entrypoints/content.ts
git commit -m "feat(ext): content script skips excludeIds (scrolls past already-processed)"
```

---

### Task 4: background — 轉發 excludeIds

**Files:** Modify `entrypoints/background.ts`

- [ ] **Step 1: cmds 型別 + handleScout 型別加 excludeIds**
- `cmds` 陣列元素 command 型別加 `excludeIds?: unknown`。
- `handleScout` 參數型別加 `excludeIds?: unknown`，呼叫處的 cast 同步加 `excludeIds?: unknown`。

- [ ] **Step 2: sendMessage 帶上 excludeIds**
在 `chrome.tabs.sendMessage(tabId, { type: "scout", keyword, criteria, budget })` 裡加：
```ts
        excludeIds: command.excludeIds,
```

- [ ] **Step 3: 建置 + typecheck**

Run: `npm run ext:build && npm run typecheck`
Expected: 成功、乾淨。

- [ ] **Step 4: Commit**
```bash
git add entrypoints/background.ts
git commit -m "feat(ext): SW relays excludeIds to content script"
```

---

### Task 5: orchestrator — 持久化到 SQLite

**Files:** Modify `src/backend/orchestrator.ts`

- [ ] **Step 1: runReview 加 tenant 參數 + 存 SQLite**
- import：`import { saveReviewItem } from "./store.js";`
- 把 `export async function runReview(candidates: ScoutCandidate[], keyword: string)` 改為 `(candidates: ScoutCandidate[], keyword: string, tenant: string)`。
- 在 `records.push({...})` 之後，對每筆呼叫 `saveReviewItem`：
```ts
      const rec = {
        id: randomUUID(),
        kind: "reply" as const,
        post: c,
        relevant: r.relevant,
        reason: r.reason,
        draft: r.draft,
        status: "pending" as const,
        created_at: new Date().toISOString(),
      };
      records.push(rec);
      saveReviewItem({
        id: rec.id,
        tenant_id: tenant,
        kind: rec.kind,
        post_id: c.id,
        post_json: JSON.stringify(c),
        relevant: r.relevant ? 1 : 0,
        reason: r.reason,
        draft: r.draft,
        status: rec.status,
        created_at: rec.created_at,
      });
```
（把原本內聯建立 record 的程式碼替換成上面這段；`ReviewRecord` 介面與其餘 log 不變。）
- 結尾的 `writeFileSync("data/review-queue.json", ...)` **保留**，但只寫「相關的」作為**非權威 dev 鏡像**（SQLite 才是權威）。log 行可註明「已存 SQLite」。

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 乾淨。

- [ ] **Step 3: Commit**
```bash
git add src/backend/orchestrator.ts
git commit -m "feat(backend): persist review items to SQLite (json becomes dev mirror)"
```

---

### Task 6: coordinator — refill 迴圈

**Files:** Create `src/backend/coordinator.ts`

- [ ] **Step 1: 建 `src/backend/coordinator.ts`**
```ts
import type { CommandQueue } from "./commandQueue.js";
import type { ScoutCandidate, ScoutCriteria, ScoutBudget } from "../core/protocol.js";
import { runReview } from "./orchestrator.js";
import { markProcessed, getProcessedIds } from "./store.js";

export interface ScoutReviewOpts {
  keyword: string;
  serpType?: "default" | "recent";
  criteria: Partial<ScoutCriteria>;
  budget: Partial<ScoutBudget>;
  targetRelevant: number;
  maxRounds?: number;
}

/** scout → LLM 篩 → 相關不足量就再 scout（跳過已處理），直到達標/達輪數/無新貼文。 */
export async function scoutAndReview(queue: CommandQueue, tenant: string, opts: ScoutReviewOpts): Promise<number> {
  const maxRounds = opts.maxRounds ?? 3;
  const fresh = process.env.DEV_FRESH === "1"; // dev：忽略歷史已處理，方便重測
  let totalRelevant = 0;

  for (let round = 1; round <= maxRounds; round++) {
    const excludeIds = fresh ? [] : getProcessedIds(tenant);
    console.log(`[refill] 第 ${round}/${maxRounds} 輪 scout（排除 ${excludeIds.length} 篇已處理）…`);
    const res = await queue.enqueue(
      tenant,
      {
        action: "scout",
        keyword: opts.keyword,
        serpType: opts.serpType,
        criteria: opts.criteria,
        budget: opts.budget,
        excludeIds,
      },
      60_000,
    );
    if (res.status === "element_not_found") {
      console.warn(`[refill] ⚠️ 選擇器疑似失效：${res.error}，停止`);
      break;
    }
    const posts = (Array.isArray(res.payload) ? res.payload : []) as ScoutCandidate[];
    if (!posts.length) {
      console.log("[refill] 本輪無新貼文，停止");
      break;
    }
    markProcessed(tenant, posts.map((p) => p.id));
    const relevant = await runReview(posts, opts.keyword, tenant);
    totalRelevant += relevant.length;
    console.log(`[refill] 第 ${round} 輪：${posts.length} 篇 → 相關 ${relevant.length}（累計 ${totalRelevant}/${opts.targetRelevant}）`);
    if (totalRelevant >= opts.targetRelevant) {
      console.log(`[refill] ✅ 已達目標相關數 ${opts.targetRelevant}`);
      break;
    }
  }
  console.log(`[refill] 結束：共 ${totalRelevant} 篇相關（目標 ${opts.targetRelevant}）`);
  return totalRelevant;
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 乾淨。

- [ ] **Step 3: Commit**
```bash
git add src/backend/coordinator.ts
git commit -m "feat(backend): refill coordinator (scout<->review until target relevant)"
```

---

### Task 7: main.ts — DEV_SCOUT 改用 coordinator

**Files:** Modify `src/backend/main.ts`

- [ ] **Step 1: 匯入 + 替換 DEV_SCOUT 內的 scout+review 邏輯**
- 頂部 import 加：`import { scoutAndReview } from "./coordinator.js";`（可移除不再用到的 `runReview`/`ScoutCandidate` import，若 typecheck 報未使用就移除）。
- 把 `DEV_SCOUT` 的 `setTimeout` 內、從 `const criteria = ...` 到列印候選/呼叫 runReview 那整段，替換為：
```ts
        const criteria = criteriaFor("us");
        const budget = budgetFor("us");
        const serpType = process.env.DEV_SERP === "recent" ? "recent" : "default";
        const targetRelevant = Number(process.env.DEV_TARGET_RELEVANT ?? 3);
        console.log(`[dev] scout serp=${serpType} minLikes=${criteria.minLikes} maxAgeHours=${criteria.maxAgeHours ?? "∞"} 目標相關=${targetRelevant}`);
        await scoutAndReview(queue, "us", { keyword, serpType, criteria, budget, targetRelevant });
```

- [ ] **Step 2: typecheck + test**

Run: `npm run typecheck && npm test`
Expected: 乾淨；21 測試綠。

- [ ] **Step 3: Commit**
```bash
git add src/backend/main.ts
git commit -m "feat(backend): DEV_SCOUT drives refill coordinator"
```

---

### Task 8（不執行，交給人）：端到端驗證

需真實 OPENAI_API_KEY + 登入 Threads 分頁 + 重載擴充。指令：
```bash
PERSONA_FILE=configs/houseguide_persona.yaml DEV_SCOUT=房地產 DEV_TARGET_RELEVANT=3 DEV_MIN_LIKES=5 DEV_MAX_AGE_HOURS=720 DEV_FRESH=1 npm run backend
```
預期：`[refill] 第 1 輪…` → 若相關不足 3，自動 `第 2 輪…`（排除上輪已處理、往下捲新貼文）→ 直到湊滿 3 篇相關或達輪數上限。`data/agent-mkt.db` 生成、`review_item` 有資料。

---

## Self-Review

**Spec coverage：** §6 review_item + processed_id（SQLite）→ Task 1/5 ✅；§8 海巡去重 → Task 2/3/4（excludeIds）✅；refill（相關不足再 scout）→ Task 6/7 ✅。

**YAGNI：** 只做 review_item + processed_id 兩表（其餘表延後）；tenant_config + rule 檢查延後 Plan 4c；review-queue.json 留作 dev 鏡像；無前期 unit test；`DEV_FRESH` 純 dev 便利。

**一致性：** scout 指令 excludeIds（Task2）→ background 轉發（Task4）→ content seed seen（Task3）；coordinator 用 store.getProcessedIds/markProcessed + orchestrator.runReview(+tenant)；main 用 coordinator。

**已知前提：** refill 跨輪靠「scout 重新導頁 + content script 跳過 excludeIds 往下捲」拿新貼文；歷史去重會讓重測撈不到舊貼文 → 用 `DEV_FRESH=1` 重測。

---

## 後續（不在本檔）

- **Plan 4c**：`tenant_config`（per-tenant keywords+criteria，scout 改從它讀）+ hard/soft rule 後驗（命中 hard_rule 標記 rule_flags、不進佇列）。
- **Plan 5**：審核台 side panel（讀 review_item → approve/edit/reject）。
- **Plan 6**：發布(B) — content/actor postReply。
