# Plan 8：多租戶身分 + Onboarding Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為每個品牌租戶建立「身分」實體與一道強制的 onboarding 設定步驟：未完成設定前擋住主功能；設定時必填品牌名稱、Threads 帳號與 owned_product（會成為 AI system prompt 核心）；完成後品牌名稱顯示於 header，其餘 3 類 agent 定義給品牌無關的預設值。

**Architecture:** 資料層已是多租戶（所有表以 `tenant_id` 為 key）。本計畫新增獨立的 `tenant` 身分表（品牌名 / Threads 帳號 / 是否已設定），與 `tenant_config`（海巡參數）、`agent_def`（4 類定義）分開。Onboarding 完成時：寫 `tenant` 身分，並用 `loadAgentDefFromFiles()` 的 persona/strategy/rule 預設 + 使用者填的 owned_product 寫入 `agent_def`。前端在 App 載入時 `GET /tenant`，未 onboarded 就只渲染 SetupWizard、隱藏主 nav。

**Tech Stack:** Node `http` + better-sqlite3（backend）、WXT + React + Tailwind v4（side panel）、TypeScript。

**範圍邊界（重要）：**
- **單一安裝 = 單一租戶**，`tenant_id` 沿用既有常數 `"us"`（前端 `api.ts` 不改 TENANT 機制）。真正的「多品牌切換 / 新增多個 Threads 帳號 / 登入驗證」**延後**（見檔尾「後續」）。本計畫只做「身分表 + 一道 onboarding gate」，這是多租戶的入口前提。
- `buildReviewerInstructions`（[src/core/prompt.ts](../../../src/core/prompt.ts)）**完全不動**：順序維持 persona + owned_product + marketing_strategy + content_writing_rule。owned_product 本就必要，本計畫只是讓它「由品牌用戶在 onboarding 時自行撰寫」。
- 議題 2（純文字 vs markdown）採「讓使用者自己選擇寫 markdown」：知識庫與 wizard 的相關欄位加 placeholder/hint，**pass-through、零後端轉換**。

**驗證慣例（沿用 Plan 6/7）：** backend 用 `npm run typecheck` + curl；前端用 `npm run ext:build`；全套人工 e2e。後端 store 層無單元測試（21 測試皆在 `src/core/`），本計畫不新增 DB 單元測試以符合既有模式與「速度優先、test 後補」偏好。無 git remote，commit 不 push。

---

## File Structure

- `src/backend/store.ts` — **Modify**：新增 `tenant` 表、`TenantInfo`/`OnboardInput` 型別、`getTenant(tenant)`、`onboardTenant(tenant, input)`（驗證必填 + 寫身分 + 用預設 seed agent_def 並覆寫 owned_product）。
- `configs/agent/persona.md` — **Modify**：改寫成品牌無關的小編人格骨架（預設值）。
- `configs/agent/owned_product.md` — **Modify**：改寫成中性 placeholder（僅作 seed fallback；onboarding 會以使用者輸入覆寫）。
- `src/backend/server.ts` — **Modify**：新增 `GET /tenant`、`POST /tenant/onboard`。
- `entrypoints/sidepanel/api.ts` — **Modify**：`TenantInfo` 型別、`fetchTenant()`、`onboardTenant()`。
- `entrypoints/sidepanel/SetupWizard.tsx` — **Create**：onboarding 表單（brand_name + threads_handle + owned_product 必填）。
- `entrypoints/sidepanel/App.tsx` — **Modify**：載入 `fetchTenant`；未 onboarded 渲染 SetupWizard（隱藏 nav）；已 onboarded 時 header 顯示動態 `brandName`。
- `entrypoints/sidepanel/KnowledgeView.tsx` — **Modify**：4 個 TextArea 加 markdown placeholder/hint（議題 2）。
- `entrypoints/sidepanel/tokens.css` — **Modify**：新增 `.dark` 語意層覆寫（日夜切換；元件零改動）。
- `entrypoints/sidepanel/icons.tsx` — **Modify**：新增 `Sun`/`Moon` icon。
- （`App.tsx` 於 Task 9 再追加主題 state + header 切換按鈕。）

---

### Task 1：store.ts 新增 tenant 身分表 + get/onboard

**Files:**
- Modify: `src/backend/store.ts`

- [ ] **Step 1: 建表**

在 `getDb()` 的 `db.exec(\`...\`)` 內，`agent_def` 表後面加：

```sql
    CREATE TABLE IF NOT EXISTS tenant (
      tenant_id TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      threads_handle TEXT NOT NULL,
      onboarded_at TEXT,
      created_at TEXT NOT NULL
    );
```

- [ ] **Step 2: 加型別與 get/onboard**

在 `setAgentDef` 之後加（`loadAgentDefFromFiles`、`setAgentDef`、`AgentDef` 已於 Plan 7 import 於本檔，可直接用）：

```ts
export interface TenantInfo {
  brandName: string;
  threadsHandle: string;
  onboarded: boolean;
}

/** 取租戶身分。無 row 視為尚未 onboarded。 */
export function getTenant(tenant: string): TenantInfo {
  const row = getDb()
    .prepare(`SELECT brand_name, threads_handle, onboarded_at FROM tenant WHERE tenant_id = ?`)
    .get(tenant) as { brand_name: string; threads_handle: string; onboarded_at: string | null } | undefined;
  if (!row) return { brandName: "", threadsHandle: "", onboarded: false };
  return { brandName: row.brand_name, threadsHandle: row.threads_handle, onboarded: row.onboarded_at != null };
}

export interface OnboardInput {
  brandName: string;
  threadsHandle: string;
  ownedProduct: string;
}

/** 完成 onboarding：驗證必填 → 寫 tenant 身分 → 用預設 + 使用者 owned_product 建 agent_def。 */
export function onboardTenant(tenant: string, input: OnboardInput): void {
  if (!input.brandName.trim() || !input.threadsHandle.trim() || !input.ownedProduct.trim()) {
    throw new Error("brandName, threadsHandle, ownedProduct are required");
  }
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO tenant (tenant_id, brand_name, threads_handle, onboarded_at, created_at)
       VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM tenant WHERE tenant_id = ?), ?))`,
    )
    .run(tenant, input.brandName.trim(), input.threadsHandle.trim(), now, tenant, now);
  const defaults = loadAgentDefFromFiles();
  setAgentDef(tenant, { ...defaults, ownedProduct: input.ownedProduct.trim() });
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: exit 0。

---

### Task 2：改寫 persona / owned_product 預設為品牌無關

**Files:**
- Modify: `configs/agent/persona.md`
- Modify: `configs/agent/owned_product.md`

- [ ] **Step 1: 改寫 persona.md（品牌無關骨架）**

整檔覆蓋為：

```markdown
# Persona — 你是誰

你是這個品牌的資深社群行銷專家，專長是把專業內容轉成一般人聽得懂、有共鳴的對話。

評估或發言時，你都站在「行銷專家」的視角：判斷「這是不是好的互動機會、會不會打中我們的受眾、品牌切入後對話自不自然」，而不只是表面主題對不對。

## 語氣
- 專業但親切好懂，不打高空、不販賣焦慮、不硬推銷。
- 像一個懂這個領域的朋友在聊天，而不是業務在推銷。
- 先提供價值、再談自家；具體、誠懇。

> 品牌的具體領域、產品、受眾與關心的主題，以「我們的產品 Owned Product」一節為準（由各品牌用戶於設定步驟填寫）。
```

- [ ] **Step 2: 改寫 owned_product.md（中性 placeholder）**

整檔覆蓋為：

```markdown
# Owned Product — 我們是做什麼的

（此為預設佔位。實際內容由各品牌用戶於「設定」步驟填寫：你是做什麼的、核心產品／服務、提供什麼價值、目標受眾是誰、關心哪些主題。這段會成為 AI 判斷相關性與寫稿的核心依據。）
```

- [ ] **Step 3: 確認 typecheck 不受影響（純內容變更）**

Run: `npm run typecheck`
Expected: exit 0（md 變更不影響型別）。

> 註：`marketing_strategy.md`、`content_writing_rule.md` 維持現有 HouseGuide 內容當預設骨架即可，本計畫不改寫（使用者可於知識庫頁自行調整）。

---

### Task 3：server.ts 加 /tenant 端點

**Files:**
- Modify: `src/backend/server.ts`

- [ ] **Step 1: 擴充 store import**

把現有的 store import（第 5 行）加入 `getTenant, onboardTenant`：

```ts
import { getAgentDef, getReviews, getTenant, getTenantConfig, onboardTenant, setAgentDef, setTenantConfig, updateReviewItem } from "./store.js";
```

- [ ] **Step 2: 加路由（放在 POST /agent-def 區塊之後、POST /scout 之前）**

```ts
    if (req.method === "GET" && url.pathname === "/tenant") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getTenant(tenant)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/tenant/onboard") {
      let body = ""; for await (const c of req) body += c;
      try {
        const tenant = url.searchParams.get("tenant") ?? "us";
        onboardTenant(tenant, JSON.parse(body));
        res.statusCode = 204; res.end();
      } catch (e) {
        res.statusCode = 400; res.end(e instanceof Error ? e.message : "bad onboard");
      }
      return;
    }
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: exit 0。

- [ ] **Step 4: curl 驗端點（用另一個埠 + 暫存 DB，不干擾既有 backend）**

```bash
export DB_FILE=$(mktemp -u /tmp/agentmkt-t8-XXXX.db)
export HTTP_PORT=18999
node --import tsx/esm src/backend/main.ts >/tmp/t8.log 2>&1 &
BPID=$!
for i in $(seq 1 40); do curl -s "http://127.0.0.1:18999/tenant?tenant=us" | grep -q onboarded && break; sleep 0.3; done
echo "GET 未設定："; curl -s "http://127.0.0.1:18999/tenant?tenant=us"; echo ""
echo "缺 owned_product -> 400："
curl -s -X POST "http://127.0.0.1:18999/tenant/onboard?tenant=us" -H "content-type: application/json" -d '{"brandName":"B","threadsHandle":"@b","ownedProduct":""}' -o /dev/null -w "status=%{http_code}\n"
echo "完整 onboard -> 204："
curl -s -X POST "http://127.0.0.1:18999/tenant/onboard?tenant=us" -H "content-type: application/json" -d '{"brandName":"BrandX","threadsHandle":"@brandx","ownedProduct":"我們做 X 服務，受眾是 Y。"}' -o /dev/null -w "status=%{http_code}\n"
echo "GET 已設定："; curl -s "http://127.0.0.1:18999/tenant?tenant=us"; echo ""
echo "agent_def 的 owned_product 應為使用者輸入："; curl -s "http://127.0.0.1:18999/agent-def?tenant=us" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const o=JSON.parse(d);console.log("ownedProduct:",o.ownedProduct);console.log("persona[0:20]:",String(o.persona).slice(0,20))})'
kill $BPID 2>/dev/null
rm -f "$DB_FILE" "$DB_FILE"-wal "$DB_FILE"-shm
```
Expected:
- GET 未設定：`{"brandName":"","threadsHandle":"","onboarded":false}`
- 缺 owned_product：`status=400`
- 完整 onboard：`status=204`
- GET 已設定：`{"brandName":"BrandX","threadsHandle":"@brandx","onboarded":true}`
- agent_def：`ownedProduct: 我們做 X 服務，受眾是 Y。`、persona 為品牌無關預設開頭

- [ ] **Step 5: Commit**

```bash
git add src/backend/store.ts src/backend/server.ts configs/agent/persona.md configs/agent/owned_product.md
git commit -m "feat(backend): tenant identity table + onboarding gate (GET /tenant, POST /tenant/onboard); brand-agnostic persona default"
```

---

### Task 4：api.ts 加 tenant 型別與呼叫

**Files:**
- Modify: `entrypoints/sidepanel/api.ts`

- [ ] **Step 1: 加 interface（放在 AgentDef interface 之後）**

```ts
export interface TenantInfo {
  brandName: string;
  threadsHandle: string;
  onboarded: boolean;
}
```

- [ ] **Step 2: 加 fetch/onboard（放在 saveAgentDef 之後）**

```ts
export async function fetchTenant(): Promise<TenantInfo> {
  const r = await fetch(`${BASE}/tenant?tenant=${TENANT}`);
  if (!r.ok) throw new Error(`fetch tenant failed: ${r.status}`);
  return r.json() as Promise<TenantInfo>;
}

export async function onboardTenant(input: { brandName: string; threadsHandle: string; ownedProduct: string }): Promise<void> {
  const r = await fetch(`${BASE}/tenant/onboard?tenant=${TENANT}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error((await r.text()) || `onboard failed: ${r.status}`);
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: exit 0。（此步不單獨 commit，與 Task 5/6 一起。）

---

### Task 5：SetupWizard.tsx

**Files:**
- Create: `entrypoints/sidepanel/SetupWizard.tsx`

- [ ] **Step 1: 建立 SetupWizard**

`entrypoints/sidepanel/SetupWizard.tsx`：

```tsx
import { useCallback, useMemo, useState } from "react";
import { onboardTenant } from "./api";
import { AlertBar, Button, Card, TextArea } from "./components";

interface SetupWizardProps {
  onComplete: () => void;
}

const inputClass =
  "min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-[14px] py-[10px] text-[var(--text-strong)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] [font:var(--fw-regular)_var(--fs-sm)/1.4_var(--font-sans)] focus:border-[var(--brand-500)] focus:shadow-[var(--shadow-focus)]";

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [brandName, setBrandName] = useState("");
  const [threadsHandle, setThreadsHandle] = useState("");
  const [ownedProduct, setOwnedProduct] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(
    () => brandName.trim() !== "" && threadsHandle.trim() !== "" && ownedProduct.trim() !== "",
    [brandName, threadsHandle, ownedProduct],
  );

  const submit = useCallback(async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await onboardTenant({ brandName: brandName.trim(), threadsHandle: threadsHandle.trim(), ownedProduct: ownedProduct.trim() });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [brandName, threadsHandle, ownedProduct, valid, onComplete]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
      <div className="flex max-w-[740px] flex-col gap-4">
        <div>
          <h2 className="[font:var(--fw-bold)_20px/1.2_var(--font-sans)] text-[var(--text-strong)]">設定您的品牌</h2>
          <p className="mt-1 [font:var(--fs-sm)/1.6_var(--font-sans)] text-[var(--text-muted)]">完成以下設定後即可開始使用。產品說明會成為 AI 判斷與寫稿的核心依據，請務必填寫。</p>
        </div>

        {error ? <AlertBar tone="warning" title="設定失敗">{error}</AlertBar> : null}

        <Card className="flex flex-col gap-[14px]">
          <label className="flex flex-col gap-[6px]">
            <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">品牌名稱 *</span>
            <input className={inputClass} value={brandName} placeholder="例：HouseGuide.ai" onChange={(e) => setBrandName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className="[font:var(--fw-medium)_var(--fs-sm)/1.3_var(--font-sans)] text-[var(--text-strong)]">Threads 帳號 *</span>
            <input className={inputClass} value={threadsHandle} placeholder="例：@houseguide" onChange={(e) => setThreadsHandle(e.target.value)} />
          </label>
        </Card>

        <Card className="flex flex-col gap-[10px]">
          <TextArea
            label="產品說明 Owned Product *"
            value={ownedProduct}
            className="min-h-[160px]"
            placeholder="你是做什麼的、核心產品/服務、提供什麼價值、目標受眾、關心的主題。可用 Markdown 語法（## 標題、- 列點、**粗體**）。"
            onChange={(e) => setOwnedProduct(e.target.value)}
          />
          <span className="[font:var(--fs-xs)/1.4_var(--font-sans)] text-[var(--text-faint)]">這段是 AI system prompt 的核心，必填。其餘人設與寫稿規範會先套用預設值，之後可在「知識庫」調整。</span>
        </Card>

        <Button variant="primary" size="lg" full className="mb-2" disabled={saving || !valid} onClick={() => void submit()}>
          {saving ? "設定中..." : "完成設定"}
        </Button>
      </div>
    </div>
  );
}
```

> 註：`inputClass` 沿用 [ScoutView.tsx](../../../entrypoints/sidepanel/ScoutView.tsx) 既有 input 樣式，維持視覺一致。

---

### Task 6：App.tsx — onboarding gate + 動態品牌名

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`

- [ ] **Step 1: 改寫 App.tsx**

整檔覆蓋為：

```tsx
import { useCallback, useEffect, useState } from "react";
import KnowledgeView from "./KnowledgeView";
import ReviewQueue from "./ReviewQueue";
import ScoutView from "./ScoutView";
import SetupWizard from "./SetupWizard";
import { fetchTenant, type TenantInfo } from "./api";
import { NavItem } from "./components";
import { BookMarked, Inbox, Radar, RefreshCw } from "./icons";

type Screen = "review" | "scout" | "kb";

export default function App() {
  const [screen, setScreen] = useState<Screen>("scout");
  const [pendingCount, setPendingCount] = useState(0);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTenant = useCallback(async () => {
    setLoading(true);
    try {
      setTenant(await fetchTenant());
    } catch {
      // 後端未連線時，當作未 onboarded（顯示 wizard，使用者會看到錯誤再重試）。
      setTenant({ brandName: "", threadsHandle: "", onboarded: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  const brandLine = tenant?.brandName?.trim() ? tenant.brandName : "尚未設定品牌";

  return (
    <div className="flex h-screen flex-col bg-[var(--surface-page)]">
      <header className="flex shrink-0 items-center gap-[10px] border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-[14px] py-[18px]">
        <img className="h-[30px] w-[30px] shrink-0" src="/logo-mark.svg" alt="" />
        <div>
          <h1 className="[font:var(--fw-bold)_15px/1.1_var(--font-sans)] text-[var(--text-strong)]">Agent MKT</h1>
          <p className="mt-0.5 font-[var(--font-mono)] text-[12px] leading-none text-[var(--text-muted)]">{brandLine}</p>
        </div>
      </header>

      {loading ? (
        <div className="grid flex-1 place-items-center gap-3 p-6 text-center text-[var(--text-muted)]">
          <RefreshCw width={28} height={28} className="animate-spin" />
          <p className="[font:var(--text-small)]">載入中...</p>
        </div>
      ) : tenant && !tenant.onboarded ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SetupWizard onComplete={() => void loadTenant()} />
        </main>
      ) : (
        <>
          <nav className="flex shrink-0 gap-1 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] p-2" aria-label="主要功能">
            <NavItem icon={<Radar />} label="海巡" active={screen === "scout"} onClick={() => setScreen("scout")} />
            <NavItem icon={<Inbox />} label="審核佇列" count={pendingCount} active={screen === "review"} onClick={() => setScreen("review")} />
            <NavItem icon={<BookMarked />} label="知識庫" active={screen === "kb"} onClick={() => setScreen("kb")} />
          </nav>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {screen === "review" ? <ReviewQueue onCountChange={setPendingCount} /> : null}
            {screen === "scout" ? <ScoutView onScoutComplete={() => setScreen("review")} /> : null}
            {screen === "kb" ? <KnowledgeView /> : null}
          </main>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: typecheck + build**

Run: `npm run typecheck && npm run ext:build`
Expected: 皆 exit 0。

- [ ] **Step 3: Commit**

```bash
git add entrypoints/sidepanel/api.ts entrypoints/sidepanel/SetupWizard.tsx entrypoints/sidepanel/App.tsx
git commit -m "feat(ext): onboarding gate (SetupWizard) blocks app until brand set; dynamic brand name in header"
```

---

### Task 7：知識庫 markdown 提示（議題 2）

**Files:**
- Modify: `entrypoints/sidepanel/KnowledgeView.tsx`

- [ ] **Step 1: 在 FIELDS 加 placeholder，並把 hint 更新為提示可用 markdown**

把 `FIELDS` 常數改成（每項加 `placeholder`）：

```tsx
const FIELDS: { key: keyof AgentDef; label: string; hint: string; placeholder: string }[] = [
  { key: "persona", label: "人設 Persona", hint: "小編是誰、語氣、立場", placeholder: "描述小編的身份與語氣。可用 Markdown（## 標題、- 列點、**粗體**）。" },
  { key: "ownedProduct", label: "自家產品 Owned Product", hint: "要行銷的產品/服務與賣點", placeholder: "你是做什麼的、核心產品/服務、價值、受眾、關心的主題。可用 Markdown。" },
  { key: "marketingStrategy", label: "行銷策略 Marketing Strategy", hint: "切入角度、目標受眾、訴求", placeholder: "切入角度、目標受眾、主要訴求。可用 Markdown。" },
  { key: "contentWritingRule", label: "寫稿規範 Content Writing Rule", hint: "hard / soft rules、用字與長度限制", placeholder: "Hard / Soft Rules、用字與長度限制。可用 Markdown（建議用 ## 分段）。" },
];
```

- [ ] **Step 2: 把 TextArea 帶上 placeholder**

在 `FIELDS.map` 的 `<TextArea ... />` 加上 `placeholder={f.placeholder}`：

```tsx
            <TextArea
              label={f.label}
              value={def[f.key]}
              className="min-h-[140px]"
              placeholder={f.placeholder}
              onChange={(e) => setDef((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run ext:build`
Expected: 皆 exit 0。

- [ ] **Step 4: Commit**

```bash
git add entrypoints/sidepanel/KnowledgeView.tsx
git commit -m "feat(ext): hint markdown is allowed in knowledge base fields (pass-through, no conversion)"
```

---

### Task 8：日夜主題 — `.dark` 語意層覆寫

**Files:**
- Modify: `entrypoints/sidepanel/tokens.css`

- [ ] **Step 1: 在 tokens.css 檔案最末端附加 `.dark` 覆寫區塊**

務必加在 `:root { ... }` 之後（source order 在後才能覆寫，兩者 specificity 相同）。原始色階（`--ink-*`/`--paper`/`--brand-*` 等）不動，只重映語意層：

```css
/* ============================================================
   Dark theme — 只覆寫語意層；元件全用語意變數，故零改動換膚。
   套用方式：document.documentElement.classList.add("dark")
   ============================================================ */
.dark {
  /* 文字 → 反相為亮色 */
  --text-strong: var(--ink-50);
  --text-body: var(--ink-150);
  --text-muted: var(--ink-400);
  --text-faint: var(--ink-500);
  --text-inverse: var(--ink-950);
  --text-link: var(--brand-300);

  /* 表面 → 深墨 */
  --surface-page: var(--ink-950);
  --surface-card: var(--ink-900);
  --surface-sunken: var(--ink-800);
  --surface-inset: var(--ink-800);
  --surface-ink: var(--ink-50);

  /* 邊框 → 中深 */
  --border-subtle: var(--ink-800);
  --border-default: var(--ink-700);
  --border-strong: var(--ink-600);

  /* 品牌（填色按鈕底色不變、hover 提亮；soft/bd 改為深底微染） */
  --brand: var(--brand-500);
  --brand-hover: var(--brand-300);
  --brand-soft: color-mix(in srgb, var(--brand-500) 16%, var(--ink-900));
  --brand-soft-bd: color-mix(in srgb, var(--brand-500) 32%, var(--ink-800));

  /* 語意 chip：soft 深底微染、bd 加深、text 提亮 */
  --success: var(--brand-500);
  --success-soft: color-mix(in srgb, var(--brand-500) 16%, var(--ink-900));
  --success-bd: color-mix(in srgb, var(--brand-500) 32%, var(--ink-800));
  --success-text: var(--brand-300);

  --warning: var(--amber-500);
  --warning-soft: color-mix(in srgb, var(--amber-500) 16%, var(--ink-900));
  --warning-bd: color-mix(in srgb, var(--amber-500) 32%, var(--ink-800));
  --warning-text: var(--amber-100);

  --danger: var(--red-500);
  --danger-soft: color-mix(in srgb, var(--red-500) 16%, var(--ink-900));
  --danger-bd: color-mix(in srgb, var(--red-500) 32%, var(--ink-800));
  --danger-text: var(--red-100);

  --info: var(--blue-500);
  --info-soft: color-mix(in srgb, var(--blue-500) 16%, var(--ink-900));
  --info-bd: color-mix(in srgb, var(--blue-500) 32%, var(--ink-800));
  --info-text: var(--blue-100);

  /* 陰影在深底加深以維持層次 */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-pop: 0 6px 16px -4px rgba(0, 0, 0, 0.6);
}
```

> `--on-brand`（品牌按鈕文字）維持白色，brand-500 上白字對比足夠，不覆寫。

- [ ] **Step 2: build 確認 CSS 不壞**

Run: `npm run ext:build`
Expected: exit 0。

- [ ] **Step 3: Commit**

```bash
git add entrypoints/sidepanel/tokens.css
git commit -m "feat(ext): dark theme via .dark semantic-token overrides (no component changes)"
```

---

### Task 9：主題切換按鈕（header）+ 持久化

**Files:**
- Modify: `entrypoints/sidepanel/icons.tsx`
- Modify: `entrypoints/sidepanel/App.tsx`

- [ ] **Step 1: 在 icons.tsx 新增 Sun / Moon**

沿用本檔既有 icon component 的簽章與寫法（接受 SVG props、`fill="none"`/`stroke="currentColor"` 風格），新增：

```tsx
export function Sun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function Moon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
```

> 若 `icons.tsx` 頂部尚未 import `SVGProps`，加上 `import type { SVGProps } from "react";`（或沿用該檔既有的 props 型別寫法）。

- [ ] **Step 2: App.tsx 追加主題 state + 切換按鈕**

在 Task 6 已重寫的 `App.tsx` 上做以下「追加」（不是整檔重寫）：

(a) 把 icons import 補上 `Sun, Moon`：
```tsx
import { BookMarked, Inbox, Moon, Radar, RefreshCw, Sun } from "./icons";
```

(b) 在 `App()` 內、`loadTenant` 定義之前，加主題狀態與套用：
```tsx
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
```

(c) 在 `<header>` 內，把切換按鈕加在品牌 `<div>…</div>` 之後（`ml-auto` 推到最右）：
```tsx
        <button
          type="button"
          onClick={() => setDark((v) => !v)}
          aria-label={dark ? "切換為日間主題" : "切換為夜間主題"}
          className="ml-auto inline-grid h-[34px] w-[34px] cursor-pointer place-items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-inset)] hover:text-[var(--text-strong)]"
        >
          {dark ? <Sun width={18} height={18} /> : <Moon width={18} height={18} />}
        </button>
```

- [ ] **Step 3: typecheck + build**

Run: `npm run typecheck && npm run ext:build`
Expected: 皆 exit 0。

- [ ] **Step 4: Commit**

```bash
git add entrypoints/sidepanel/icons.tsx entrypoints/sidepanel/App.tsx
git commit -m "feat(ext): day/night theme toggle in header (persisted, follows system default)"
```

---

### Task 10（人工 e2e，交給使用者）

1. 重置 DB（走全新 onboarding 路徑）：`rm -f data/agent-mkt.db data/agent-mkt.db-wal data/agent-mkt.db-shm`
2. `npm run backend`（先關掉舊 backend）；`npm run ext:build` → chrome://extensions 重載 → 開 side panel。
3. **預期看到 SetupWizard，主 nav（海巡/審核/知識庫）不出現。**
4. 只填品牌名稱、不填產品說明 → 「完成設定」維持 disabled。三欄都填 → 可送出。
5. 送出後 → 進入主頁，header 第二行顯示剛填的品牌名稱。
6. 知識庫頁：owned_product 應為剛填內容，persona/strategy/rule 為預設；各欄 placeholder 提示可用 markdown。
7. 海巡一次 → 草稿應反映你填的品牌（而非 HouseGuide）。
8. `sqlite3 data/agent-mkt.db "SELECT tenant_id, brand_name, threads_handle, onboarded_at IS NOT NULL FROM tenant;"` 確認身分已寫入。
9. 點 header 右上的日夜切換鈕：整個 UI（含 wizard、海巡、審核、知識庫）應在亮/暗主題間正確翻面；重開 side panel 後主題選擇應保留（localStorage）。

---

## Self-Review

**1. Spec coverage：**
- 議題 1「新增帳號要先走設定步驟、填完才進主頁」→ Task 6 gate + Task 5 wizard ✅
- 「品牌名稱顯示在 header」→ Task 6 動態 `brandLine` ✅
- 「owned_product 必填、為 system prompt 一部分」→ Task 1 `onboardTenant` 驗證 + 寫入 agent_def ✅
- 「persona 要 general、其餘給預設」→ Task 2 改寫 persona/owned_product 預設；onboard 用 `loadAgentDefFromFiles` 帶 3 類預設 ✅
- 議題 2「讓使用者自己選擇寫 markdown」→ Task 7 placeholder/hint + wizard owned_product hint；prompt builder 不動 ✅
- 交集「順序維持原樣」→ 未碰 `buildReviewerInstructions` ✅
- 日夜切換（額外需求）→ Task 8 `.dark` 語意覆寫 + Task 9 header 切換鈕（持久化、跟隨系統預設）；元件零改動 ✅

**2. Placeholder scan：** 每個 code step 皆給完整程式碼；curl 含預期輸出；無 TBD/TODO。✅

**3. Type consistency：**
- `TenantInfo`（brandName/threadsHandle/onboarded）在 store(Task1)/server(Task3)/api(Task4)/App(Task6) 一致 ✅
- `OnboardInput` / `onboardTenant(input)` 欄位（brandName/threadsHandle/ownedProduct）在 store(Task1)/server(Task3)/api(Task4)/wizard(Task5) 一致 ✅
- `onboardTenant` 用 `loadAgentDefFromFiles()` + `setAgentDef`（皆 Plan 7 已存在於 store.ts）；`AgentDef` 來自 core/prompt ✅
- 循環 import：store → agentDef（單向，僅讀檔），server → store，無新循環 ✅

**已知前提：** `configs/agent/` 四份 md 存在；`marketing_strategy.md`/`content_writing_rule.md` 維持現有內容當預設。

---

## 後續（不在本檔）

- **Plan 9：發布 poster** — approved reply 經節流 sender 逐篇間隔發到 Threads，閉合 MVP 迴圈（原 Plan 8，順延）。
- **真・多租戶**（延後到有第二個品牌付費時）：登入/驗證、伺服器端「Threads 帳號 ↔ tenant」綁定、前端動態 `tenant_id`（取代寫死的 `"us"`，改存 `chrome.storage`）、多帳號切換 UI、後端對 `/scout` 等強制 onboarding 檢查。
- **泊車區清理**：PoC（electron-vite 等）擇期移除。
