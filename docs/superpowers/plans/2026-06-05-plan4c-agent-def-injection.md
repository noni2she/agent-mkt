# Plan 4c: 4 類 agent 定義注入 prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。
>
> **執行紀律（使用者偏好）**：速度優先、不 over-design、只做必要功能、不寫前期 unit test，測試後補。

**Goal:** 把 agent 定義整理成 4 類獨立 md（persona / owned product / marketing strategy / content writing rule，含 hard/soft rules），**全部注入 reviewer prompt**，讓 LLM 用它們做「相關性判斷 + 寫 reply」（一次合併呼叫）。不做事後 rule 檢查、不擋下——人審把關。

**Architecture:** 4 份定義 md 已建於 `configs/agent/`（persona.md / owned_product.md / marketing_strategy.md / content_writing_rule.md）。新增 `backend/agentDef`（讀 4 md）。`core/prompt` 改成吃 4 個文字塊組 prompt。reviewer/orchestrator 改用 AgentDef 取代結構化 Persona。

**Tech Stack:** 既有 Plan 4a/4b 鏈路。

**決策**（已確認）：rules 注入 prompt、不後驗、人審把關；一次合併呼叫，注入全部 4 類；4 類拆成獨立 md（已建）；不加 minReplies；現在 markdown/檔案、DB+UI 留設定頁里程碑。

參考 spec §4（core/prompt）、§5（A5 知識）、§11 里程碑3。

---

### Task 1: core/prompt — 吃 4 類定義組 prompt

**Files:** Rewrite `src/core/prompt.ts`

- [ ] **Step 1: 改寫 `src/core/prompt.ts`（整檔替換）**
```ts
/** agent 的 4 類定義（現在來自 configs/agent/*.md；未來來自 DB）。 */
export interface AgentDef {
  persona: string;
  ownedProduct: string;
  marketingStrategy: string;
  contentWritingRule: string;
}

/** 組 reviewer agent 的 instructions：注入 4 類定義，供「相關性判斷 + 寫 reply」用。 */
export function buildReviewerInstructions(def: AgentDef, keyword: string): string {
  return [
    `# 你的身份 Persona`,
    def.persona,
    ``,
    `# 我們的產品 Owned Product`,
    def.ownedProduct,
    ``,
    `# 行銷策略 Marketing Strategy`,
    def.marketingStrategy,
    ``,
    `# 寫作規範 Content Writing Rule`,
    def.contentWritingRule,
    ``,
    `---`,
    `以上是你的身份、產品知識、行銷策略與寫作規範。針對使用者提供的一篇 Threads 貼文：`,
    `1) 用行銷專家視角判斷它是否與關鍵字「${keyword}」及我們的品牌／受眾／策略高度相關、且值得互動。`,
    `2) 若相關：嚴格依「寫作規範」（含 Hard/Soft Rules、文筆、reply 規範）寫一則回覆草稿。`,
    `3) 若不相關：relevant=false、draft 留空字串。`,
    `輸出 relevant(布林)、reason(簡短中文理由)、draft(回覆草稿；不相關則空字串)。`,
  ].join("\n");
}
```
（移除原本 `import type { Persona }` 與舊版函式。）

- [ ] **Step 2: typecheck**（會因 reviewer.ts 還在用舊簽章而報錯，屬預期——Task 3 修）。先確認 `src/core/prompt.ts` 自身語法無誤即可，整體 typecheck 留到 Task 3 後綠。

- [ ] **Step 3: Commit**
```bash
git add src/core/prompt.ts
git commit -m "feat(core): buildReviewerInstructions injects 4 agent-definition blocks"
```

---

### Task 2: backend/agentDef — 讀 4 份定義 md

**Files:** Create `src/backend/agentDef.ts`

- [ ] **Step 1: 建 `src/backend/agentDef.ts`**
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentDef } from "../core/prompt.js";

/** 讀 4 份 agent 定義 md（現在 configs/agent/；未來 DB）。 */
export function loadAgentDef(dir = process.env.AGENT_DIR ?? "configs/agent"): AgentDef {
  const read = (f: string) => readFileSync(join(dir, f), "utf8").trim();
  return {
    persona: read("persona.md"),
    ownedProduct: read("owned_product.md"),
    marketingStrategy: read("marketing_strategy.md"),
    contentWritingRule: read("content_writing_rule.md"),
  };
}
```

- [ ] **Step 2: Commit**
```bash
git add src/backend/agentDef.ts
git commit -m "feat(backend): load 4 agent-definition md files"
```

---

### Task 3: reviewer — 改用 AgentDef

**Files:** Modify `src/backend/reviewer.ts`

- [ ] **Step 1: 改 reviewer.ts**
- import 改為：
```ts
import type { ScoutCandidate } from "../core/protocol.js";
import { buildReviewerInstructions, type AgentDef } from "../core/prompt.js";
```
（移除 `import type { Persona } from "../core/types.js";`。）
- `reviewCandidate` 簽章把 `persona: Persona` 換成 `def: AgentDef`：
```ts
export async function reviewCandidate(
  candidate: ScoutCandidate,
  def: AgentDef,
  keyword: string,
): Promise<ReviewOutput> {
```
- Agent 的 `instructions` 改為 `buildReviewerInstructions(def, keyword)`。
- 其餘（ReviewOutputSchema、model、outputType、maxTokens、retry 迴圈、input）不變。

- [ ] **Step 2: typecheck**（仍會因 orchestrator 用舊呼叫報錯，Task 4 修）

- [ ] **Step 3: Commit**
```bash
git add src/backend/reviewer.ts
git commit -m "feat(backend): reviewer uses AgentDef instead of structured Persona"
```

---

### Task 4: orchestrator — load agentDef + 收尾 + 清理

**Files:** Modify `src/backend/orchestrator.ts`；Delete `src/backend/persona.ts`、`configs/houseguide_persona.yaml`、`configs/content_strategy.md`

- [ ] **Step 1: 改 orchestrator.ts**
- 移除 `import { loadPersona } from "./persona.js";`，改 `import { loadAgentDef } from "./agentDef.js";`
- `runReview` 內把 `const persona = loadPersona();` 改成 `const def = loadAgentDef();`
- 把 `reviewCandidate(c, persona, keyword)` 改成 `reviewCandidate(c, def, keyword)`
- 其餘不變。

- [ ] **Step 2: 刪除被取代的舊檔**
```bash
git rm src/backend/persona.ts configs/houseguide_persona.yaml configs/content_strategy.md
```
（persona loader 與舊的混合式 persona.yaml / strategy.md 已被 4 份定義取代。）

- [ ] **Step 3: typecheck + test（現在應全綠）**

Run: `npm run typecheck && npm test`
Expected: 乾淨；21 測試綠。

- [ ] **Step 4: Commit**
```bash
git add src/backend/orchestrator.ts
git commit -m "feat(backend): orchestrator loads AgentDef; remove superseded persona.ts + old config files"
```

---

### Task 5（不執行，交給人）：端到端驗證

需真實 OPENAI_API_KEY + 登入 Threads 分頁 + 重載擴充。注意：**不再需要 `PERSONA_FILE`**（改讀 `configs/agent/`，可用 `AGENT_DIR` 覆寫）。
```bash
DEV_SCOUT=房地產 DEV_TARGET_RELEVANT=3 DEV_MIN_LIKES=5 DEV_MAX_AGE_HOURS=360 DEV_FRESH=1 npm run backend
```
預期：判斷與草稿明顯反映 4 類定義（行銷專家視角判斷相關性、草稿守文筆/reply 規範與 hard/soft rules）。

---

## Self-Review

**Spec coverage：** §4 core/prompt（注入知識）→ Task 1 ✅；A5 人核心知識（persona/strategy/rules）注入 → Task 1/2 ✅（現以 md 檔，DB 留里程碑6）；判斷+寫稿用定義 → Task 3/4 ✅。

**YAGNI：** 不做 rule 後驗/擋下（人審）；不建 SQLite 設定表（檔案）；不加 minReplies；一次合併呼叫（不拆兩步）。

**一致性：** AgentDef（core/prompt）↔ agentDef loader（backend）↔ reviewer ↔ orchestrator；刪除被取代的 persona.ts + 舊 config。

**已知前提：** 4 份定義 md 已存在於 `configs/agent/`（本計畫不建內容，只接程式）。

---

## 後續（不在本檔）

- **Plan 5**：審核台 side panel（讀 review_item → approve/edit/reject）。
- **Plan 6**：發布(B) — content/actor postReply。
- **設定頁里程碑**：4 類定義 + 海巡參數 進版本化 DB，使用者 UI 編輯。
- **Phase 2**：原創貼文生成（用同一套 4 類定義 + 排程）。
