# Session Handoff — agent-mkt 重新設計（AI 行銷小編 for Threads）

> Saved: 2026-06-13 | Project: agent-mkt（branch `main`，已 push 到 github.com:noni2she/agent-mkt）

## Current Task
重新設計 agent-mkt：Threads AI 行銷小編 SaaS（海巡熱門貼文 → LLM 判斷相關性+寫 reply 草稿 → 人審 → dry-run 預覽確認 → 發布），全程 human-in-the-loop。**MVP 迴圈閉合（Plan 1–10a 已實作；Plan 10a 尚待人工 e2e）。** 此 handoff 隨 repo 帶到新電腦使用。

## Progress
- [x] Plan 1–6（地基 / HTTP polling / scout content / LLM 判斷+寫稿 / SQLite+refill / 4 類 agent 定義注入 / 審核台 / 海巡 UI+觸發）
- [x] Plan 7 知識庫 UI（agent_def 表、orchestrator 讀 DB、KnowledgeView）
- [x] Plan 8 多租戶 onboarding + 日夜切換（tenant 表、SetupWizard gate、動態品牌名、`.dark` 語意覆寫、header 切換鈕）
- [x] Plan 9 發布 poster（poster loop + posterTuning + post_reply command + content DOM 操作 + main 啟動，預設 dry-run）
- [x] Plan 10a dry-run 人工確認閘（`previewing` 狀態、poster preview gate、resolve endpoint、側欄確認/取消、content best-effort 自動偵測）
- [x] 一批 e2e 回饋修正：暗色文字提亮、按鈕無 focus ring、保留已決定紀錄（按鈕 disable + 卡片淡化）、number spinner 隱藏、知識庫 textarea 行距縮窄、標籤 brand-text token 跟主題翻面、scout `/scout` 端點接 budget（修掉 budget=空）+ scoutTuning 集中 D16 旋鈕
- [x] 中央 D16 旋鈕：`src/backend/scoutTuning.ts`（`SCOUT_*` env）、`src/backend/posterTuning.ts`（`POSTER_*` env），不開放使用者
- [ ] **使用者跑 Plan 10a e2e**：dry-run（`POSTER_DRY_RUN=1` 預設）驗證第一篇進 `previewing` 後不會切走下一篇；人工 resolve 後才進下一輪 cooldown

## Key Decisions
- **brain/hands**：後端 `src/backend/`=brain（LLM/workflow/persistence/poster），擴充 `entrypoints/`=hands（SW+content+sidepanel）。
- **通道 = HTTP polling**（取代 WS），SW chrome.alarms 拉 `/poll`、`/result` 回報。
- **範式 B 主 A 備**：B=腳本化選擇器；A=agentic 探索（延後）。`element_not_found` 縫已留。
- **LLM = `@openai/agents`（GPT）+ OpenAI API key**；`gpt-5-mini` 不收 temperature。
- **4 類 agent 定義**：persona / owned_product / marketing_strategy / content_writing_rule，**一次合併呼叫**注入做判斷+寫稿；rules 注入 prompt、不後驗、人審把關。`buildReviewerInstructions` 順序維持 persona → owned_product → strategy → rule（**不要改**）。
- **多租戶範圍（D17，Plan 8 邊界）**：單一安裝＝單一租戶，`api.ts` 與所有後端寫死 tenant `"us"`。真·多租戶（auth、Threads 帳號↔tenant 綁定、動態 tenant_id 存 chrome.storage、品牌切換 UI、強制 /scout onboarding 檢查）**全部延後**到有第二個品牌付費。
- **threads_handle = 純辨識標籤**：AI 小編 ≠ Threads 帳號（一對多），海巡實際抓「當前登入分頁」DOM，handle 不切帳號。
- **owned_product = onboarding 必填**：system prompt 核心、各品牌自寫，自然成為 onboarding 必填；其餘 3 類用品牌無關預設。persona.md/owned_product.md 已改寫為品牌無關骨架，特異性全交 owned_product 承載。
- **議題 2 markdown = 純提示**：`buildReviewerInstructions` 已用 markdown 標題分段；不做自動轉換（成本/竄改/失敗點），只加 placeholder 提示「可用 Markdown」讓使用者自選。GPT-4 級模型對格式 robust（arxiv 2411.10541）。
- **D16 護城河**：cooldown、節奏、擬人、scout budget、poster session 上限全部**內部**，集中在 `scoutTuning.ts`/`posterTuning.ts`，`.env` 覆寫。**不開放使用者 UI/tenant_config**。
- **日夜切換**：設計系統是兩層 token（原始色階 → 語意層），元件只用語意層。`.dark` 重映語意層 ~20 變數即翻面，**元件零改動**。額外加 `--brand-text`（亮=brand-700、暗=brand-300）解決暗色下 brand chip 字色過深問題。
- **執行模式**：subagent-driven 紀律 + Codex 當 executor。**逐單元（plan 的 commit 邊界）派 Codex、主 session 在單元間 review（spec+品質+自證）後 commit**。trivial 1–2 行改動主 session 直接做。
- **審核佇列保留已決定紀錄**（你選的）：核准/跳過後**卡片留在列表**、status 就地更新、按鈕 disable、卡片 opacity-60；計數從資料推導（不再本地累加），nav badge 只算 pending。
- **Poster 預設 dry-run**：跑完整 DOM 流程但不真送出，避免第一次驗證誤觸真實 Threads 帳號；切實機改 `.env` 的 `POSTER_DRY_RUN=0`。
- **Plan 10a dry-run gate**：dry-run 成功填入草稿後狀態改 `previewing`，poster loop 看到任何 `previewing` 就不抓下一筆 approved；側欄或 content auto-detect 透過 `/api/v1/preview/resolve` 推進成 `sent`/`skipped`。
- **失敗不重試**（poster）：選擇器失效或 submit timeout → log + 保留 status=approved，**絕對不重複發**。

## Key Files
- `docs/superpowers/specs/2026-06-02-agent-mkt-redesign-design.md` — 設計總綱（D1–D16，D17 多租戶邊界）
- `docs/superpowers/plans/2026-06-*` — Plan 1–9，**Plan 9 是當前最後一張**
- `docs/design/agent-mkt-design-system/` — Claude Design handoff（tokens / 9 元件 / console 規格）
- `src/backend/`：
  - `store.ts` — SQLite（review_item/processed_id/tenant_config/agent_def/tenant），get/save 全套；`getNextApproved` 給 poster；Plan 10a 加 `previewing_at`、`hasPreviewing`、`sweepStalePreviews`、`getReviewItem`
  - `server.ts` — 端點：/poll /result /config /scout(+/status,/stop) /reviews /review /agent-def /tenant /tenant/onboard；Plan 10a 新增 `POST /api/v1/preview/resolve`
  - `scoutTuning.ts` / `posterTuning.ts` — **D16 旋鈕的家**（`SCOUT_*` / `POSTER_*` env）
  - `poster.ts` — 常駐 loop（找 approved → throttle.gateReply → enqueue post_reply）；live path 成功仍 `status=sent`，dry-run 成功改 `status=previewing` 並等待人工 resolve；失敗保留 approved
  - `orchestrator.ts` / `coordinator.ts` / `reviewer.ts` / `agentDef.ts` / `commandQueue.ts` / `main.ts`
- `src/core/`：`prompt.ts`（**不要動 buildReviewerInstructions**）、`protocol.ts`（Command discriminatedUnion）、`throttle.ts`（SessionThrottle）、`filter.ts` / `adapters.ts` / `types.ts`
- `entrypoints/`：`background.ts`(SW)、`content.ts`(scout + post_reply DOM)、`sidepanel/`（App+gate+theme / SetupWizard / ScoutView / ReviewQueue / KnowledgeView / api.ts / components/ / icons.tsx / tokens.css 含 `.dark` / style.css）
- `configs/agent/*.md` — 4 類預設（persona/owned_product 已品牌無關化；onboarding 時用前 3 類當 seed，owned_product 由使用者覆寫）；`configs/business_rules.yaml`（舊 PoC 用，新後端**沒讀**，留檔參考）
- `.env.example` — 列出所有 SCOUT_* 與 POSTER_* 旋鈕（**新電腦記得複製成 .env 並填 OPENAI_API_KEY**）

## Pending Questions
- 無阻擋。等使用者跑 Plan 10a e2e（dry-run previewing → resolve → 下一篇）。

## Context for Next Session
- **新電腦設置（搬機 checklist）**：
  1. `git clone git@github.com:noni2she/agent-mkt.git && cd agent-mkt`
  2. `npm install`
  3. `cp .env.example .env` → 填入 `OPENAI_API_KEY`（舊機在 .env 內，沒進 git）
  4. `npm run typecheck && npm test`（應 26 tests 綠）
  5. `npm run backend`（埠 18900，需登入 Threads 分頁）
  6. `npm run ext:build` → chrome://extensions 重載 → 點圖示開 side panel
- **省 token**：實作派 Codex（codex:codex-rescue --resume），主 session 不把大檔/設計拉進 context；UI 從簡、重用 `entrypoints/sidepanel/components/`。
- **驗證**：`npm run typecheck` / `npm test`(26) / `npm run ext:build`。
- **重置 DB**（觸發 onboarding 重跑）：`rm -f data/agent-mkt.db data/agent-mkt.db-wal data/agent-mkt.db-shm`，首次啟動會走 SetupWizard + 自 md seed。查資料 `sqlite3 data/agent-mkt.db "..."`。
- **避開埠衝突的測試 server**：`HTTP_PORT=18999 DB_FILE=$(mktemp -u /tmp/agentmkt-XXXX.db) npm run backend` 起測試 server，不擾既有 backend。
- **血淚約束**：`gpt-5-mini` 不收 temperature；WXT 釘 0.19.29（0.20.x 撞 Vite5）；Tailwind v4；MV3 圖示不用 CDN；ext:build 後**一定要重載擴充**才生效。
- **使用者偏好**：速度優先 MVP、test 後補、YAGNI、UI 從簡省 token、subagent 預設 Codex、所有功能最終都要能從 UI 觸發/設定、**做完驗證過就直接 commit 不用問**。
- **Plan 10a dry-run e2e 步驟**：
  1. 確保 Threads 已登入 → `npm run backend`（log 應出現 `[poster] 啟動：dryRun=true ...`），side panel 海巡並核准 2–3 篇
  2. 等 4–11 分鐘 → Threads 分頁被導去第一篇、草稿填入；**不會再繼續切走第二篇**
  3. 側欄看到該 item 狀態變「預覽中」+ 兩顆按鈕
  4. 親手在 Threads 按送出 → 等 ≤ 3 秒 → 側欄狀態自動變「已送出」（auto-detect 路徑生效）
  5. 或：手動按側欄「確認送出」/「取消發送」→ 同樣推進
  6. 推進後等下一次 cooldown → 第二篇被切過去 → 重複
- **後續工作（不在 Plan 10a）**：選擇器移到 adapter 層集中維護；失敗重試/dead-letter；發送節奏儀表板；真·多租戶；Plan 10b audit log / 操作記錄。
