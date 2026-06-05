# Plan 4a: 後端 LLM — 相關性判斷 + reply 草稿 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。
>
> **執行紀律（使用者偏好）**：速度優先、**不 over-design、只做必要功能**、**不寫前期 unit test**（驗證靠手動 e2e + typecheck），測試後補。

**Goal:** scout 候選 → 後端對每篇用 `@openai/agents` 跑一次「判斷與關鍵字/品牌相關性 + 若相關寫 reply 草稿」→ 把相關的寫進 `data/review-queue.json` 並 log。打通 PoC 從沒驗證過的 LLM 寫稿鞭（§D）。

**Architecture:** 沿用 Plan 2/3 polling + scout。新增後端：`core/prompt`（純函式組 instructions）、`backend/persona`（讀 yaml）、`backend/reviewer`（@openai/agents 結構化呼叫）、`backend/orchestrator`（批次跑 + 寫 JSON）。LLM 認證用 `OPENAI_API_KEY`（per-token），封裝在 reviewer 內，未來換端點只動這裡。

**Tech Stack:** `@openai/agents@0.11.4`（已安裝；`Agent`/`run`/`finalOutput`/`outputType` API 已查證）、`openai`、`zod`、`yaml`（皆已安裝）、`persona_example.yaml`。

**決策**（已與使用者確認）：用 `@openai/agents`；每篇一次合併呼叫（判相關+草稿）；輸出先 `data/review-queue.json`（SQLite 留 Plan 4b）；persona 先讀 `configs/persona_example.yaml`（tenant_config 留 Plan 4b）。

**前置需求：** `.env` 需有可用的 `OPENAI_API_KEY`（會產生真實 API token 費用）。`OPENAI_MODEL` 預設 gpt-4o。

參考 spec §4（core/prompt、LLMClient）、§10（LLM/成本）、§11 里程碑 3。

---

### Task 1: core/prompt — 組 reviewer instructions（純函式）

**Files:** Create `src/core/prompt.ts`

- [ ] **Step 1: 建 `src/core/prompt.ts`**
```ts
import type { Persona } from "./types.js";

/** 組 reviewer agent 的 instructions：判斷貼文與關鍵字/品牌相關性 + 寫回覆草稿。 */
export function buildReviewerInstructions(persona: Persona, keyword: string): string {
  const p = persona;
  const s = p.style_fingerprint;
  return [
    `你是「${p.display_name}」(@${p.handle}) 的社群小編。`,
    `品牌定位：${p.brand.purpose}`,
    `語氣：${p.brand.voice}`,
    `受眾：${p.brand.audience.age_range}，興趣 ${p.brand.audience.interests.join("、")}`,
    `文筆：emoji 頻率 ${s.emoji_frequency}，常用 ${s.common_emojis.join("")}，語氣標記 ${s.tone_markers.join("、")}`,
    ``,
    `任務：針對使用者提供的一篇 Threads 貼文，判斷它是否與關鍵字「${keyword}」以及本品牌相關且值得互動。`,
    `- 若相關：用上述品牌語氣寫一則「自然、不硬推、能引發互動」的回覆草稿（繁體中文，${p.reply_habits.length === "short" ? "簡短" : "適中"}）。`,
    `- 若不相關（純政治、與品牌主題無關、廣告洗版等）：relevant=false，draft 留空字串。`,
    `務必輸出 relevant(布林)、reason(簡短中文理由)、draft(回覆草稿；不相關則空字串)。`,
  ].join("\n");
}
```

- [ ] **Step 2: typecheck + 確認既有測試未壞**

Run: `npm run typecheck && npm test`
Expected: 乾淨；既有 21 測試綠（新增純函式不影響）。

- [ ] **Step 3: Commit**
```bash
git add src/core/prompt.ts
git commit -m "feat(core): add buildReviewerInstructions (persona -> reviewer prompt)"
```

---

### Task 2: backend/persona — 讀 persona yaml

**Files:** Create `src/backend/persona.ts`

- [ ] **Step 1: 建 `src/backend/persona.ts`**
```ts
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Persona } from "../core/types.js";

/** 讀 persona yaml（現在 configs/persona_example.yaml；Plan 4b 改 tenant_config）。 */
export function loadPersona(path = process.env.PERSONA_FILE ?? "configs/persona_example.yaml"): Persona {
  return parse(readFileSync(path, "utf8")) as Persona;
}
```

- [ ] **Step 2: 手動驗證可讀**

Run: `node --import tsx/esm -e "import('./src/backend/persona.ts').then(m => console.log(m.loadPersona().display_name))"`
Expected: 印出 `範例品牌小編`（或 yaml 裡的 display_name）。若路徑錯誤，確認從 repo 根目錄執行。

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: 乾淨。

- [ ] **Step 4: Commit**
```bash
git add src/backend/persona.ts
git commit -m "feat(backend): load persona from yaml"
```

---

### Task 3: backend/reviewer — @openai/agents 結構化呼叫

**Files:** Create `src/backend/reviewer.ts`

- [ ] **Step 1: 建 `src/backend/reviewer.ts`**
```ts
import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { Persona } from "../core/types.js";
import type { ScoutCandidate } from "../core/protocol.js";
import { buildReviewerInstructions } from "../core/prompt.js";

export const ReviewOutputSchema = z.object({
  relevant: z.boolean(),
  reason: z.string(),
  draft: z.string(),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

/** 對一篇候選貼文：判斷相關性 + 寫草稿（單次 LLM 呼叫，每篇 token 上限）。 */
export async function reviewCandidate(
  candidate: ScoutCandidate,
  persona: Persona,
  keyword: string,
): Promise<ReviewOutput> {
  const agent = new Agent({
    name: "reply-reviewer",
    instructions: buildReviewerInstructions(persona, keyword),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    outputType: ReviewOutputSchema,
    modelSettings: { maxTokens: 500 },
  });
  const input = `貼文（作者 @${candidate.author_handle}，👍${candidate.likes}）：\n${candidate.text}`;
  const result = await run(agent, input);
  return result.finalOutput as ReviewOutput;
}
```

- [ ] **Step 2: 驗證 API 形狀 + typecheck**

Run: `npm run typecheck`
Expected: 乾淨。
- ⚠️ 若 typecheck 對 `outputType: ReviewOutputSchema`（zod）或 `modelSettings.maxTokens` 報錯：請查 `node_modules/@openai/agents-core/dist/agent.d.ts` 與 `model.d.ts` 的實際欄位——`outputType` 可能需要包裝（如 SDK 的 structured-output helper），`maxTokens` 欄位名可能不同（如 `max_tokens` 或在 `modelSettings` 內其他鍵）。依實際型別最小調整，保持「結構化 `{relevant,reason,draft}` + 每篇 token 上限」兩個目標不變，並在報告註明你改了什麼。

- [ ] **Step 3: Commit**
```bash
git add src/backend/reviewer.ts
git commit -m "feat(backend): reviewer via @openai/agents (relevance + draft, structured output, token cap)"
```

---

### Task 4: backend/orchestrator — 批次跑 + 寫 review-queue.json

**Files:** Create `src/backend/orchestrator.ts`

- [ ] **Step 1: 建 `src/backend/orchestrator.ts`**
```ts
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import type { ScoutCandidate } from "../core/protocol.js";
import { loadPersona } from "./persona.js";
import { reviewCandidate } from "./reviewer.js";

export interface ReviewRecord {
  id: string;
  kind: "reply";
  post: ScoutCandidate;
  relevant: boolean;
  reason: string;
  draft: string;
  status: "pending";
  created_at: string;
}

/** 對一批 scout 候選跑 LLM 判斷+草稿，寫 data/review-queue.json，回傳相關的。 */
export async function runReview(candidates: ScoutCandidate[], keyword: string): Promise<ReviewRecord[]> {
  const persona = loadPersona();
  const records: ReviewRecord[] = [];
  for (const c of candidates) {
    try {
      const r = await reviewCandidate(c, persona, keyword);
      records.push({
        id: randomUUID(),
        kind: "reply",
        post: c,
        relevant: r.relevant,
        reason: r.reason,
        draft: r.draft,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      console.log(`  ${r.relevant ? "✅" : "⛔"} @${c.author_handle} — ${r.reason}`);
      if (r.relevant) console.log(`     → ${r.draft}`);
    } catch (e) {
      console.warn(`  ⚠️ review 失敗 @${c.author_handle}: ${(e as Error).message}`);
    }
  }
  const relevant = records.filter((r) => r.relevant);
  mkdirSync("data", { recursive: true });
  writeFileSync("data/review-queue.json", JSON.stringify(relevant, null, 2), "utf8");
  console.log(`[review] ${candidates.length} 篇 → 相關 ${relevant.length} 篇，已寫入 data/review-queue.json`);
  return relevant;
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 乾淨。

- [ ] **Step 3: Commit**
```bash
git add src/backend/orchestrator.ts
git commit -m "feat(backend): orchestrator runs review batch -> data/review-queue.json"
```

---

### Task 5: 接進 main.ts DEV_SCOUT + 端到端驗證

**Files:** Modify `src/backend/main.ts`

- [ ] **Step 1: 在 main.ts 匯入並串接**

在 `main.ts` 頂部 import 區加：
```ts
import { runReview } from "./orchestrator.js";
import type { ScoutCandidate } from "../core/protocol.js";
```
在 `DEV_SCOUT` 區塊裡，把現有「列出候選清單」那段（`const posts = Array.isArray(r.payload) ...` 起的迴圈）替換為「拿到候選後跑 LLM review」：
```ts
        const posts = (Array.isArray(r.payload) ? r.payload : []) as ScoutCandidate[];
        console.log(`[dev] scout 回傳 ${posts.length} 篇候選，開始 LLM 判斷…`);
        if (posts.length) await runReview(posts, keyword);
```
（保留前面 `r.status === "element_not_found"` 的告警判斷不動；只替換候選清單的列印迴圈。）

- [ ] **Step 2: typecheck + 既有測試**

Run: `npm run typecheck && npm test`
Expected: 乾淨；21 測試綠。

- [ ] **Step 3: 端到端手動驗證（需真實 OPENAI_API_KEY，會產生 token 費用）**

前置：確認 `.env` 有有效 `OPENAI_API_KEY`（與 `OPENAI_MODEL`，預設 gpt-4o）。重新載入擴充、Chrome 開著登入的 Threads 分頁，然後：
```bash
DEV_SCOUT=台股 DEV_TARGET=3 DEV_MIN_LIKES=5 npm run backend
```
（用小 `DEV_TARGET=3` 控成本）

Expected 後端輸出類似：
```
[dev] scout 回傳 3 篇候選，開始 LLM 判斷…
  ✅ @someone — 與台股相關、討論個股
     → （品牌語氣的回覆草稿…）
  ⛔ @other — 純政治貼文，與品牌無關
[review] 3 篇 → 相關 2 篇，已寫入 data/review-queue.json
```
並確認 `data/review-queue.json` 存在、內含相關貼文的草稿。

- [ ] **Step 4: 排查**
- `401/invalid api key` → 檢查 `.env` 的 `OPENAI_API_KEY`。
- `outputType`/結構化輸出報錯 → 回到 Task 3 Step 2 依實際型別調整。
- 全部 `relevant=false` → 可能 model 太嚴或 persona 與關鍵字不搭（persona_example 是咖啡品牌、關鍵字台股本就不相關！測試可改 `DEV_SCOUT=咖啡` 或換貼近 persona 的關鍵字，重點是驗證鏈路會判斷+寫稿）。

- [ ] **Step 5: Commit**
```bash
git add src/backend/main.ts
git commit -m "feat(backend): wire DEV_SCOUT -> LLM review pipeline"
```

---

## Self-Review

**Spec coverage：** §4 core/prompt → Task 1 ✅；LLM 鏈路（§11 里程碑3、§D 未驗證）→ Task 3/4/5 ✅；§10 每篇 token 上限 → Task 3 modelSettings ✅；persona 來源（yaml，tenant_config 留 Plan 4b）→ Task 2 ✅。

**YAGNI / 不 over-design：** 用既有 deps；輸出先 JSON（SQLite 留 4b）；persona 先 yaml；每篇單次合併呼叫；無 refill 迴圈（留 4b）、無 hard/rule 後驗（留後續）、無 LLMClient 泛型介面（reviewer 直接封裝 @openai/agents）、無前期 unit test。

**一致性：** reviewer 用 `ScoutCandidate`（Plan 3）+ `Persona`（core/types）+ `buildReviewerInstructions`（Task 1）；orchestrator → main DEV_SCOUT 串接；認證 `OPENAI_API_KEY` 封裝在 reviewer。

**已知前提/風險：** 需真實 API key + token 費用；persona_example 是咖啡品牌，與「台股」天生不相關，驗證相關性時用貼近 persona 的關鍵字；`@openai/agents` 的 `outputType`/`maxTokens` 欄位以實際型別為準（Task 3 Step 2 有調整指引）。

---

## 後續（不在本檔）

- **Plan 4b**：SQLite store（review_item/tenant_config）+ scout 從 tenant_config 讀條件 + refill 迴圈（相關不足量再 scout）+ hard/soft rule 後驗。
- **Plan 5**：審核台 side panel（讀 review-queue → approve/edit/reject）。
- **Plan 6**：發布(B) — content/actor postReply。
