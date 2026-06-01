# agent-mkt 重新設計 — Brainstorming 啟動簡報

> **用途**：作為新 session 啟動 `superpowers:brainstorming` 的**自包含輸入**。
> **閱讀順序**：先看 §A（暫定決策，做快速複檢）→ 再看 §B（仍待探索，這才是 brainstorming 的主場）→ §C/§D 是約束與背景。
> **紀律**：
>
> - §A 是前幾輪在「另一個 session」收斂的暫定決策，**附理由**。本 session 請做一次**獨立的快速挑戰式複檢**（challenge pass），目的是抵銷上個 session 可能的偏見——**不是**重新從零探索。
>   - 找到「實質更優的方案」或「邏輯漏洞」才停下來與使用者討論；否則標記「確認」直接跳過，不重新推導。
> - §B 才是本 session 的主要工作，允許自由提新選項與 trade-off。

---

## 0. 產品一句話

AI 小編 SaaS：幫品牌 / 行銷部門在 Threads 上執行行銷，降低成本、放大力道。
三支核心功能：**海巡**（搜熱門貼文）、**reply**（對熱門貼文回覆）、**原創貼文**（自家產品行銷文）。全程 human-in-the-loop。

---

## A. 暫定決策（做快速挑戰式複檢，確認或標記，不重新推導）

### A1. 營運模式 = 小編輔助起步

- MVP：agent 海巡 + 出草稿，**人必審每一則 reply 與每一篇自家貼文**，核可後才發 / 才排程。
- 半自動 / 全自動為**未來目標**，非 MVP。

### A2. 租戶 = 單租戶部署，但資料模型 tenant-aware

- 商業模式終局是**訂閱制多租戶 SaaS**；初期僅用自家新創行銷帳號測試 = **單一品牌內部使用**。
- 現在**不建**註冊 / 訂閱 / 計費 / 租戶隔離基礎設施（YAGNI）。
- 但**不可寫死單品牌假設**：「tenant / 品牌」從一開始就是參數（現在恆等於「我們自己」）；知識庫、secret、帳號都依 tenant key 組織，未來長多租戶零痛苦。

### A3. 部署形態 = 後端 + 薄前端（雙介面為終局）

- 終局要 **Chrome Extension 與 Electron 兩個介面**。
- 依 §C 的 MV3 限制，這**強制**架構為：**共用後端**（agent 編排 + LLM + 知識庫 + secrets + 排程）+ **薄前端**（只負責顯示與審核操作）。
- **後端為必做**，非選項。前端退化成顯示層。

### A4. 多平台共用 = core + adapter 拆分（必做）

- `core`（純邏輯：filter / prompt 組裝 / types / 規則 / 節流，零平台依賴）一份共用。
- `adapter`（Storage / LLMClient / BrowserDriver / SecretStore）介面共用、各平台各實作。
- PoC 目前邏輯與 I/O 黏死（`pipeline.ts` 混在一起），重設計要切開。

### A5. 知識庫切分 = 人工核心 + AI 加法洞察

- 區別不是「持久 vs 不持久」（兩者都持久化），而是**誰有寫入權**：

  | 檔案                                              | 寫入權          | AI 權限          |
  | ------------------------------------------------- | --------------- | ---------------- |
  | `persona.md` / `strategy.md` / `style.md`（核心） | 人類 only       | 唯讀             |
  | `learned_insights.md`（加法洞察）                 | AI 可寫（加法） | 增補，人類可刪修 |

- 真相來源放**後端**、依 tenant 切分、加**版本控管**（可回滾、可追溯哪一版產生爛貼文）。前端最多本地快取，非權威。
- **不要**讓 AI 整篇重寫核心 md（高風險：漂移 / 過擬合 / 退化）。AI 只做加法補強。

### A6. retrospective（自我成長）= 加法式 + 監督強度綁自動化程度

- 借鏡 Hermes 實證可行的設計：**累積記憶（加法）+ 定期 nudge**，而非覆寫核心。
- 核心原則：**監督強度 ∝ 營運自動化程度**
  - 人審每則 reply（MVP）→ reply 人審即是安全網，洞察層可輕量自動，**不需逐筆提案制**。
  - 半自動 / 全自動（未來）→ 安全網消失，洞察層**須恢復**提案 / 審核閘門。
- 最低限度：保留**定期 digest**（讓人看「AI 近期學到哪些洞察」、可一鍵刪爛的），防記憶污染 / 過時。
- retrospective 本身做成**開關**，預設可關。

### A7. 範圍分階段（YAGNI）

- **MVP**：海巡 → reply → 人審 → 發（這條已被 PoC 驗證）。
- **Phase 2**：原創行銷貼文生成 + 排程發布。
- 不要一次全做。

---

## B. 仍待 brainstorming 探索（這才是新 session 的工作）

> 以下皆為開放議題，允許提新選項與 trade-off。

1. **後端技術選型**：語言 / 框架 / 部署方式（自架？serverless？）；agent loop 跑在哪。
2. **第一個前端先做哪個**：Extension 還是 Electron？（PoC 已有可用 React 審核 UI，重用成本低；但 extension 海巡較簡單）
3. **core / adapter 的具體模組邊界**：每個 unit 的職責、介面、依賴怎麼切。
4. **海巡的執行位置**：Extension content script（讀 DOM）vs 後端 Playwright/CDP——成本、可靠度、封號風險各如何。
5. **排程系統設計**：cron 觸發海巡、自家貼文排程發布的機制。
6. **成本控管**：每篇貼文可接受的 token / Turn 上限；model 選擇。
7. **反偵測 / 封號 / 節流策略**（自動操作 Threads 的核心風險，目前需求未涵蓋）。
8. **資料儲存技術**：DB / 物件儲存選型；queue / history / 知識庫 / 版本控管怎麼存。
9. **reply 產出策略**：一篇出一稿還是多稿讓人選。
10. **retrospective digest 的 UX 與頻率**：每日 / 每週？呈現形式？

---

## C. 已查證的平台約束（Chrome Extension MV3 — 硬限制）

- service worker idle 約 **15–30 秒被終止** → 無法承載多 Turn 長時間 agent loop（**必須在後端**）。
- **無檔案系統** → queue / processed_ids / history / 知識庫不能用 fs，須後端或 chrome.storage。
- **禁止 remotely hosted code**、CSP 限制 → 含 Node built-ins 的 npm 套件多數無法 bundle。
- `@openai/agents` 為 Node 設計，瀏覽器端多數會炸。
- **API key 放 extension = 可被任何人解出**（已有實際盜 key 案例）→ secret 必須在後端。

## D. PoC 背景（資產與血淚約束）

**已驗證可行**

- 瀏覽器自動化 + LLM 抽取貼文（`data/queue.json` 有真實資料）。
- LLM 依熱門門檻自篩。
- Electron + React 審核台 UI 可渲染。

**尚未驗證（風險）**

- reply 草稿生成（`queue.json` 中 `draft` 全空，寫作鏈路未跑通）。
- 端到端發文（poster）。
- 完整迴圈閉合、每篇成本上限。

**技術血淚約束（直接當前提）**

- `evaluate_script` 的 function 參數必須是完整 function 宣告。
- Electron preload 必須輸出 CJS（`"type":"module"` 會產出 sandbox 拒絕的 `.mjs`）。
- `gpt-5-mini` 不接受 `temperature`。
- GitHub Models API 與 Copilot 訂閱是兩套獨立 rate limit。

**現有可複用程式碼**

- 純邏輯：`src/skills/scout/filter.ts`、`workflow/throttle.ts`、`shared/types.ts`、prompt 組裝。
- write-post skill 雛形：`src/skills/write-post/`（Phase 2 原創貼文的起點）。

---

## E. 給新 session 的啟動指引

1. 讀完本檔，先對 §A 做一次**快速挑戰式複檢**：逐條確認或標記異議（找到實質更優方案 / 邏輯漏洞才停下討論，否則跳過）。
2. 複檢後，brainstorming 聚焦 §B 的開放議題。
3. 建議起手：先收斂 §B-1（後端技術選型）與 §B-2（第一個前端），因為它們決定其餘骨架。
