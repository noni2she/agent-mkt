# Plan 7：知識庫 UI（agent 定義 → DB）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 4 類 agent 定義（persona / owned_product / marketing_strategy / content_writing_rule）從 `configs/agent/*.md` 搬進 DB，並在 side panel 開「知識庫」頁讓使用者用 UI 編輯，後端 LLM 判斷+寫稿改從 DB 讀。

**Architecture:** 比照既有 `tenant_config` 模式，新增 `agent_def` 表（4 個獨立欄位，一租戶一列）。首次啟動 DB 無資料時，用 `configs/agent/*.md` 當 seed 灌入（md 檔保留為預設/fallback）。後端加 `GET/POST /agent-def`，前端加 `KnowledgeView.tsx`（4 個 TextArea + 明確「儲存」按鈕，重用既有元件）。`orchestrator.ts` 從讀檔改為讀 DB（帶 tenant）。

**Tech Stack:** Node `http` + better-sqlite3（backend）、WXT + React + Tailwind v4（side panel）、TypeScript。

**驗證慣例（沿用 Plan 6）：** backend 用 `npm run typecheck` + curl 驗端點；前端用 `npm run ext:build`；全套人工 e2e。無 git remote，commit 不 push。本專案後端 store 層無單元測試（21 測試皆在 `src/core/`），本計畫不新增 DB 單元測試以符合既有模式與「速度優先、test 後補」偏好。

---

## File Structure

- `src/backend/agentDef.ts` — **Modify**：把現有 `loadAgentDef(dir)` 改名為 `loadAgentDefFromFiles(dir)`（純讀檔，當 seed 來源）。不再被 orchestrator 直接用。
- `src/backend/store.ts` — **Modify**：新增 `agent_def` 建表、`getAgentDef(tenant)`（含首次 seed）、`setAgentDef(tenant, def)`。import `loadAgentDefFromFiles` 當 seed（store → agentDef 單向，無循環）。
- `src/backend/orchestrator.ts` — **Modify**：`loadAgentDef()` → `getAgentDef(tenant)`。
- `src/backend/server.ts` — **Modify**：新增 `GET /agent-def`、`POST /agent-def` 路由。
- `entrypoints/sidepanel/api.ts` — **Modify**：新增 `AgentDef` interface、`fetchAgentDef()`、`saveAgentDef()`。
- `entrypoints/sidepanel/KnowledgeView.tsx` — **Create**：知識庫頁，4 個 TextArea + 儲存按鈕，重用 `Card`/`TextArea`/`Button`/`AlertBar`。
- `entrypoints/sidepanel/App.tsx` — **Modify**：`screen === "kb"` 從 `<Placeholder>` 換成 `<KnowledgeView />`。

> `AgentDef` 型別在 `src/core/prompt.ts` 已存在（`persona / ownedProduct / marketingStrategy / contentWritingRule`），backend 沿用；前端 `api.ts` 自行宣告同形 interface。

---

### Task 1：agentDef.ts 改名為檔案 seed loader

**Files:**
- Modify: `src/backend/agentDef.ts`

- [ ] **Step 1: 改名 loader（純讀檔，當 seed 來源）**

把整個檔案改成：

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentDef } from "../core/prompt.js";

/** 讀 4 份 agent 定義 md（僅作 DB 首次 seed 的預設來源）。 */
export function loadAgentDefFromFiles(dir = process.env.AGENT_DIR ?? "configs/agent"): AgentDef {
  const read = (f: string) => readFileSync(join(dir, f), "utf8").trim();
  return {
    persona: read("persona.md"),
    ownedProduct: read("owned_product.md"),
    marketingStrategy: read("marketing_strategy.md"),
    contentWritingRule: read("content_writing_rule.md"),
  };
}
```

- [ ] **Step 2: typecheck（會因 orchestrator 仍用舊名而紅，下一個 Task 修）**

Run: `npm run typecheck`
Expected: 報錯 `orchestrator.ts` 找不到 `loadAgentDef`（預期；Task 3 修好）。先不 commit，續做 Task 2/3 後一起驗證綠了再 commit。

---

### Task 2：store.ts 新增 agent_def 表 + get/set（含首次 seed）

**Files:**
- Modify: `src/backend/store.ts`

- [ ] **Step 1: 建表**

在 `getDb()` 的 `db.exec(\`...\`)` 字串內，`tenant_config` 表後面加上：

```sql
    CREATE TABLE IF NOT EXISTS agent_def (
      tenant_id TEXT PRIMARY KEY,
      persona TEXT NOT NULL,
      owned_product TEXT NOT NULL,
      marketing_strategy TEXT NOT NULL,
      content_writing_rule TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
```

- [ ] **Step 2: 加 import 與 get/set**

在檔案頂部 import 區加上：

```ts
import { loadAgentDefFromFiles } from "./agentDef.js";
import type { AgentDef } from "../core/prompt.js";
```

在 `setTenantConfig` 之後加上：

```ts
/** 取某租戶的 agent 定義。DB 無資料時用 configs/agent/*.md seed 後回傳。 */
export function getAgentDef(tenant: string): AgentDef {
  const d = getDb();
  const row = d
    .prepare(`SELECT persona, owned_product, marketing_strategy, content_writing_rule FROM agent_def WHERE tenant_id = ?`)
    .get(tenant) as
    | { persona: string; owned_product: string; marketing_strategy: string; content_writing_rule: string }
    | undefined;
  if (row) {
    return {
      persona: row.persona,
      ownedProduct: row.owned_product,
      marketingStrategy: row.marketing_strategy,
      contentWritingRule: row.content_writing_rule,
    };
  }
  // 首次：用檔案 seed 並寫入 DB
  const seed = loadAgentDefFromFiles();
  setAgentDef(tenant, seed);
  return seed;
}

/** 寫入某租戶的 agent 定義。 */
export function setAgentDef(tenant: string, def: AgentDef): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO agent_def
       (tenant_id, persona, owned_product, marketing_strategy, content_writing_rule, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(tenant, def.persona, def.ownedProduct, def.marketingStrategy, def.contentWritingRule, new Date().toISOString());
}
```

- [ ] **Step 3: typecheck（仍會因 orchestrator 紅，Task 3 修）**

Run: `npm run typecheck`
Expected: 仍報 `orchestrator.ts` 舊名錯誤；store.ts 本身無錯。續 Task 3。

---

### Task 3：orchestrator 改讀 DB（帶 tenant）

**Files:**
- Modify: `src/backend/orchestrator.ts`

- [ ] **Step 1: 換 import**

把 `import { loadAgentDef } from "./agentDef.js";` 改成從 store 取：

```ts
import { getAgentDef, saveReviewItem } from "./store.js";
```

（移除原本 `import { loadAgentDef } from "./agentDef.js";` 與單獨的 `import { saveReviewItem } from "./store.js";`，合併成上面一行。）

- [ ] **Step 2: 改用 getAgentDef(tenant)**

在 `runReview` 內，把 `const def = loadAgentDef();` 改成：

```ts
  const def = getAgentDef(tenant);
```

（`tenant` 已是 `runReview(candidates, keyword, tenant)` 的參數。）

- [ ] **Step 3: typecheck 應全綠**

Run: `npm run typecheck`
Expected: exit 0（Task 1–3 合起來型別一致）。

- [ ] **Step 4: 跑既有測試確認沒回歸**

Run: `npm test`
Expected: 21 測試綠。

- [ ] **Step 5: Commit**

```bash
git add src/backend/agentDef.ts src/backend/store.ts src/backend/orchestrator.ts
git commit -m "feat(backend): agent_def table + getAgentDef (seed from md files); orchestrator reads DB per tenant"
```

---

### Task 4：server.ts 加 /agent-def 端點

**Files:**
- Modify: `src/backend/server.ts`

- [ ] **Step 1: 擴充 store import**

把第 5 行的 import 改成（加入 `getAgentDef, setAgentDef`）：

```ts
import { getAgentDef, getReviews, getTenantConfig, setAgentDef, setTenantConfig, updateReviewItem } from "./store.js";
```

- [ ] **Step 2: 加路由（放在 POST /config 區塊之後）**

在 `POST /config` 的 `return;` 之後、`POST /scout` 之前插入：

```ts
    if (req.method === "GET" && url.pathname === "/agent-def") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getAgentDef(tenant)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/agent-def") {
      let body = ""; for await (const c of req) body += c;
      try {
        const tenant = url.searchParams.get("tenant") ?? "us";
        setAgentDef(tenant, JSON.parse(body));
        res.statusCode = 204; res.end();
      } catch {
        res.statusCode = 400; res.end("bad agent-def");
      }
      return;
    }
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: exit 0。

- [ ] **Step 4: curl 驗端點**

啟動後端（另一個終端機）：`npm run backend`
然後：

```bash
curl -s "http://127.0.0.1:18900/agent-def?tenant=us" | head -c 200
```
Expected: 回 JSON，含 `persona`/`ownedProduct`/`marketingStrategy`/`contentWritingRule` 四個 key（首次呼叫會自動 seed 自 md 檔）。

往返寫入測試：

```bash
curl -s -X POST "http://127.0.0.1:18900/agent-def?tenant=us" -H "content-type: application/json" -d '{"persona":"P","ownedProduct":"O","marketingStrategy":"M","contentWritingRule":"C"}' -o /dev/null -w "%{http_code}\n"
curl -s "http://127.0.0.1:18900/agent-def?tenant=us"
```
Expected: 第一行 `204`；第二行回 `{"persona":"P","ownedProduct":"O",...}`。
（驗完可重置 DB 還原 seed：`rm -f data/agent-mkt.db data/agent-mkt.db-wal data/agent-mkt.db-shm`，下次啟動會重 seed。）

- [ ] **Step 5: Commit**

```bash
git add src/backend/server.ts
git commit -m "feat(backend): GET/POST /agent-def endpoints"
```

---

### Task 5：api.ts 加 AgentDef 型別與呼叫

**Files:**
- Modify: `entrypoints/sidepanel/api.ts`

- [ ] **Step 1: 加 interface（放在 TenantConfig interface 之後）**

```ts
export interface AgentDef {
  persona: string;
  ownedProduct: string;
  marketingStrategy: string;
  contentWritingRule: string;
}
```

- [ ] **Step 2: 加 fetch/save（放在 saveConfig 之後）**

```ts
export async function fetchAgentDef(): Promise<AgentDef> {
  const r = await fetch(`${BASE}/agent-def?tenant=${TENANT}`);
  if (!r.ok) throw new Error(`fetch agent-def failed: ${r.status}`);
  return r.json() as Promise<AgentDef>;
}

export async function saveAgentDef(def: AgentDef): Promise<void> {
  const r = await fetch(`${BASE}/agent-def?tenant=${TENANT}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(def),
  });
  if (!r.ok) throw new Error(`save agent-def failed: ${r.status}`);
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: exit 0。（此步不單獨 commit，與 Task 6 一起。）

---

### Task 6：KnowledgeView.tsx + 掛上 nav

**Files:**
- Create: `entrypoints/sidepanel/KnowledgeView.tsx`
- Modify: `entrypoints/sidepanel/App.tsx`

- [ ] **Step 1: 建立 KnowledgeView**

`entrypoints/sidepanel/KnowledgeView.tsx`：

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAgentDef, saveAgentDef, type AgentDef } from "./api";
import { AlertBar, Button, Card } from "./components";
import { TextArea } from "./components";
import { RefreshCw } from "./icons";

const EMPTY_DEF: AgentDef = { persona: "", ownedProduct: "", marketingStrategy: "", contentWritingRule: "" };

const FIELDS: { key: keyof AgentDef; label: string; hint: string }[] = [
  { key: "persona", label: "人設 Persona", hint: "小編是誰、語氣、立場" },
  { key: "ownedProduct", label: "自家產品 Owned Product", hint: "要行銷的產品/服務與賣點" },
  { key: "marketingStrategy", label: "行銷策略 Marketing Strategy", hint: "切入角度、目標受眾、訴求" },
  { key: "contentWritingRule", label: "寫稿規範 Content Writing Rule", hint: "hard / soft rules、用字與長度限制" },
];

function defKey(def: AgentDef): string {
  return JSON.stringify(def);
}

export default function KnowledgeView() {
  const [def, setDef] = useState<AgentDef>(EMPTY_DEF);
  const [savedKey, setSavedKey] = useState(defKey(EMPTY_DEF));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => defKey(def) !== savedKey, [def, savedKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgentDef();
      setDef(data);
      setSavedKey(defKey(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      await saveAgentDef(def);
      setSavedKey(defKey(def));
      setMessage("知識庫已儲存");
      window.setTimeout(() => setMessage(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [def, dirty]);

  if (loading) {
    return (
      <div className="grid flex-1 place-items-center gap-3 p-6 text-center text-[var(--text-muted)]">
        <RefreshCw width={28} height={28} className="animate-spin" />
        <p className="[font:var(--text-small)]">載入知識庫...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="flex max-w-[740px] flex-col gap-4">
        <div>
          <h2 className="[font:var(--fw-bold)_20px/1.2_var(--font-sans)] text-[var(--text-strong)]">知識庫</h2>
          <p className="mt-1 [font:var(--fs-sm)/1.6_var(--font-sans)] text-[var(--text-muted)]">編輯 AI 小編的人設與寫稿規範；判斷相關性與草擬回覆時會注入這些定義。</p>
        </div>

        {error ? <AlertBar tone="warning" title="後端尚未連線">{error}</AlertBar> : null}
        {message ? <AlertBar tone="success">{message}</AlertBar> : null}

        {FIELDS.map((f) => (
          <Card key={f.key} className="flex flex-col gap-[10px]">
            <TextArea
              label={f.label}
              value={def[f.key]}
              className="min-h-[140px]"
              onChange={(e) => setDef((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
            <span className="[font:var(--fs-xs)/1.4_var(--font-sans)] text-[var(--text-faint)]">{f.hint}</span>
          </Card>
        ))}

        <Button variant="primary" size="lg" full className="mb-2" disabled={saving || !dirty} onClick={() => void persist()}>
          {saving ? "儲存中..." : dirty ? "儲存知識庫" : "已儲存"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: App.tsx 掛上 KnowledgeView**

加 import（第 2–3 行附近）：

```tsx
import KnowledgeView from "./KnowledgeView";
```

把第 43 行的 placeholder 換掉：

```tsx
        {screen === "kb" ? <KnowledgeView /> : null}
```

並移除不再使用的 `Placeholder` 函式（若 `kb` 是它最後一個使用者；確認後刪除 `function Placeholder(...)` 整段，避免 lint 未使用警告）。

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run ext:build`
Expected: 皆 exit 0。

- [ ] **Step 4: Commit**

```bash
git add entrypoints/sidepanel/api.ts entrypoints/sidepanel/KnowledgeView.tsx entrypoints/sidepanel/App.tsx
git commit -m "feat(ext): knowledge base view to edit agent defs (reusing components)"
```

---

### Task 7（人工 e2e，交給使用者）

1. 重置 DB（確保走 seed 路徑）：`rm -f data/agent-mkt.db data/agent-mkt.db-wal data/agent-mkt.db-shm`
2. `npm run backend`；`npm run ext:build` → chrome://extensions 重載 → 開 side panel。
3. 知識庫頁：四欄應預填自 `configs/agent/*.md`。改其中一欄（如 persona），按「儲存知識庫」→ 出現「已儲存」。
4. 重整 side panel（或重開）→ 確認改動有持久化（從 DB 讀回）。
5. 海巡一次 → 確認 LLM 判斷/草稿反映新的定義（與改動方向一致）。
6. `sqlite3 data/agent-mkt.db "SELECT tenant_id, substr(persona,1,40) FROM agent_def;"` 確認 DB 有資料。

---

## Self-Review

**1. Spec coverage：**
- 設計總綱「設定頁里程碑：4 類定義進版本化 DB，使用者 UI 編輯」→ Task 2（DB）+ Task 6（UI）✅
- Plan 4c 檔尾「DB 留里程碑6」→ 本計畫完成搬遷 ✅
- D16 護城河（cooldown/節奏/擬人不入 UI）→ 本頁只動 agent 定義，未碰內部參數 ✅

**2. Placeholder scan：** 每個 code step 皆給完整程式碼；curl/命令含預期輸出；無 TBD/TODO。✅

**3. Type consistency：**
- backend 用 `src/core/prompt.ts` 的 `AgentDef`（persona/ownedProduct/marketingStrategy/contentWritingRule）；DB 欄位 snake_case，get/set 內對映 camelCase ✅
- `getAgentDef`/`setAgentDef` 命名在 store(Task2)/orchestrator(Task3)/server(Task4) 一致 ✅
- 前端 `api.ts` 的 `AgentDef`（Task5）同形；`KnowledgeView`（Task6）`keyof AgentDef` 迭代四欄 ✅
- 循環 import 檢查：store → agentDef（單向，僅讀檔）；orchestrator → store；server → store。無循環 ✅

**已知前提：** `configs/agent/` 四份 md 已存在（seed 來源），本計畫不改其內容。

---

## 後續（不在本檔）

- **Plan 8**：發布 poster — approved reply 經節流 sender 逐篇間隔發到 Threads，閉合 MVP 迴圈。
- **泊車區清理**：PoC（src/main,renderer,browser,... + electron-vite）擇期一起移除。
