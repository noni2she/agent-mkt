# Plan 6: 海巡 UI + 觸發 + tenant_config Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development。
> **紀律**：速度優先、不 over-design、不寫前期 unit test。**UI 像素級還原照設計，但能重用既有元件就重用、不重刻。讀設計/檔由實作者自己讀，不要我代讀。**

**Goal:** 讓試用者從 UI 設定海巡條件 + 一鍵「執行海巡」，不再靠 env。新增 `tenant_config`（DB，scout 條件來源，取代 `DEV_*`），`POST /scout` 觸發，side panel 多一個「海巡」頁（照設計 Screen A）。

**設計來源（實作者自己讀）：** `docs/design/agent-mkt-design-system/project/design_handoff/README.md` 的 **Screen A — 海巡 (Scout)** 段 + `ui_kits/console/index.html` 對應畫面 + tokens。
**重用既有元件：** `entrypoints/sidepanel/components/`（Button/Card/Field/TextArea/Badge/StatusChip…）+ `tokens.css`。**不要重建元件。**

對齊：cooldown/throttle 仍內部（D16，不放進 tenant_config / UI）。

---

### Task 1: store — tenant_config（DB）

Modify `src/backend/store.ts`。加表 + 讀寫：
```ts
// getDb() 的 db.exec 內加一張表：
//   CREATE TABLE IF NOT EXISTS tenant_config (tenant_id TEXT PRIMARY KEY, config_json TEXT NOT NULL, updated_at TEXT NOT NULL);

export interface TenantConfig {
  keywords: string[];
  minLikes: number;
  maxAgeHours: number | null;
  targetRelevant: number;
  excludeKeywords: string[];
  serpType: "default" | "recent";
}

const DEFAULT_CONFIG: TenantConfig = {
  keywords: ["房地產"],
  minLikes: 100,
  maxAgeHours: 720,
  targetRelevant: 3,
  excludeKeywords: [],
  serpType: "default",
};

export function getTenantConfig(tenant: string): TenantConfig {
  const row = getDb().prepare(`SELECT config_json FROM tenant_config WHERE tenant_id = ?`).get(tenant) as
    | { config_json: string }
    | undefined;
  return row ? { ...DEFAULT_CONFIG, ...JSON.parse(row.config_json) } : DEFAULT_CONFIG;
}

export function setTenantConfig(tenant: string, config: TenantConfig): void {
  getDb()
    .prepare(`INSERT OR REPLACE INTO tenant_config (tenant_id, config_json, updated_at) VALUES (?, ?, ?)`)
    .run(tenant, JSON.stringify(config), new Date().toISOString());
}
```
驗證：`npm run typecheck && npm test`（21 綠）。Commit `feat(backend): tenant_config store (scout settings)`.

---

### Task 2: server — GET/POST /config + POST /scout

Modify `src/backend/server.ts`。`createPollServer(queue)` 內加三路由（沿用既有 CORS）。import `getTenantConfig, setTenantConfig` from store、`scoutAndReview` from coordinator：
```ts
    if (req.method === "GET" && url.pathname === "/config") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getTenantConfig(tenant)));
      return;
    }
    if (req.method === "POST" && url.pathname === "/config") {
      let body = ""; for await (const c of req) body += c;
      try { const tenant = url.searchParams.get("tenant") ?? "us"; setTenantConfig(tenant, JSON.parse(body)); res.statusCode = 204; res.end(); }
      catch { res.statusCode = 400; res.end("bad config"); }
      return;
    }
    if (req.method === "POST" && url.pathname === "/scout") {
      const tenant = url.searchParams.get("tenant") ?? "us";
      let body = ""; for await (const c of req) body += c;
      let keyword = "";
      try { keyword = (JSON.parse(body || "{}").keyword as string) ?? ""; } catch {}
      const cfg = getTenantConfig(tenant);
      const kw = keyword || cfg.keywords[0] || "";
      if (!kw) { res.statusCode = 400; res.end("no keyword"); return; }
      // fire-and-forget：背景跑，立刻回 202；UI 之後 poll /reviews
      void scoutAndReview(queue, tenant, {
        keyword: kw,
        serpType: cfg.serpType,
        criteria: { minLikes: cfg.minLikes, maxAgeHours: cfg.maxAgeHours ?? undefined, excludeKeywords: cfg.excludeKeywords },
        budget: {},
        targetRelevant: cfg.targetRelevant,
      }).catch((e) => console.error("[scout] 失敗:", e));
      res.statusCode = 202; res.end();
      return;
    }
```
注意：`createPollServer` 目前簽章是 `(queue: CommandQueue)`；`scoutAndReview` 需要 queue（已有）。若有循環 import 問題（server↔coordinator↔orchestrator），最小調整即可。
驗證：`npm run typecheck`；啟後端 curl `GET /config?tenant=us` 回預設 JSON。Commit `feat(backend): /config + /scout endpoints (UI-triggered scout)`.

---

### Task 3: 後端改從 tenant_config 讀（DEV_* 變 override）

Modify `src/backend/main.ts`。DEV_SCOUT 路徑改成：以 `getTenantConfig("us")` 為基底，`DEV_*` env 若有設則覆寫（dev 方便）。保持行為等價但來源改 DB。（criteriaFor/budgetFor 可保留為 env override helper。）
驗證 typecheck + test。Commit `feat(backend): scout reads tenant_config (env as dev override)`.

---

### Task 4: side panel 海巡頁（照設計 Screen A、重用元件）

Create `entrypoints/sidepanel/ScoutView.tsx`；Modify `App.tsx`（海巡 nav 不再 placeholder，掛 ScoutView）、`api.ts`（加 config/scout 呼叫）。

**實作者請自己讀** `docs/design/.../design_handoff/README.md` 的 Screen A 規格與 `ui_kits/console/index.html`，**像素級還原**海巡頁，**重用** `components/`（Button/Card/Field/TextArea/Badge）。

`api.ts` 加：
```ts
export interface TenantConfig { keywords: string[]; minLikes: number; maxAgeHours: number | null; targetRelevant: number; excludeKeywords: string[]; serpType: "default" | "recent"; }
export async function fetchConfig(): Promise<TenantConfig> { return (await fetch(`${BASE}/config?tenant=${TENANT}`)).json(); }
export async function saveConfig(c: TenantConfig): Promise<void> { await fetch(`${BASE}/config?tenant=${TENANT}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) }); }
export async function runScout(keyword?: string): Promise<void> { await fetch(`${BASE}/scout?tenant=${TENANT}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ keyword }) }); }
```

ScoutView 行為（照設計）：
- 載入 `fetchConfig()` 帶入表單：關鍵字（pills 可加/刪）、min_likes、max_age_hours、target、exclude、serpType（default/recent 切換）。
- 編輯 → `saveConfig()`（失焦或按儲存）。
- **執行海巡** 按鈕（primary，radar icon）→ `runScout()` → 顯示 spinner（約 2s）→ 切到「審核佇列」頁（之後該頁 poll `/reviews` 會出現新項目）。
- 結果統計列（瀏覽/通過/加入佇列）非必要，先省略或佔位（無此即時資料）。

App.tsx：nav 三項（海巡 / 審核佇列 / 知識庫）；海巡=ScoutView、審核佇列=ReviewQueue、知識庫=佔位。預設停在海巡或審核佇列皆可。

驗證：`npm run ext:build && npm run typecheck`。Commit `feat(ext): scout view (config + 執行海巡) per design, reusing components`.

---

### Task 5（人工 e2e）
重載擴充 → 開 side panel → 海巡頁：改條件、按執行海巡 → 後端跑 scout→review → 切審核佇列看到新項目。

---

## Self-Review
- Spec：§9 設定/觸發 UI、§11 里程碑（海巡 UI + tenant_config）；D16 cooldown 不入 config ✅。
- YAGNI：tenant_config 用 JSON blob；POST /scout fire-and-forget；結果統計先省；**重用既有元件不重刻**。
- 一致：`/config`/`/scout`(Task2) ↔ api.ts(Task4)；scout 來源 tenant_config(Task1/3)。
- 後續：Plan 7 設定/知識庫 UI（agent 定義→DB）、Plan 8 發布 poster。
