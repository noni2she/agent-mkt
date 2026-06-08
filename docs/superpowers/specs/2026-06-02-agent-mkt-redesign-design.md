# agent-mkt 重新設計 — 設計稿（Design Spec）

> 日期：2026-06-02
> 來源：`docs/redesign-brief.md` 的 brainstorming 收斂結果
> 狀態：待使用者審核 → 通過後進 writing-plans

---

## 0. 產品一句話

AI 小編 SaaS：幫品牌 / 行銷部門在 Threads 上執行行銷，降低成本、放大力道。
三支核心功能：**海巡**（搜熱門貼文）、**reply**（對熱門貼文回覆）、**原創貼文**（自家產品行銷文）。全程 human-in-the-loop。

---

## 1. 本次重設計的關鍵轉折（相對 brief 的更新）

brainstorming 過程中查證出三件 brief 未涵蓋、且改變設計前提的事實：

1. **官方 Threads API 已能覆蓋三功能**（keyword search / replies / publishing），但需 Meta App Review + 海巡受 ~500 查詢/7 天限制。→ 決定**不進 MVP**，但保留為可抽換 adapter（理由：審核迴圈干擾快速迭代）。
2. **「AI 操作瀏覽器」分兩層**：決策層（選哪篇/何時）vs 執行層（實際 dispatch 事件）。封號風險的行為生物特徵在**執行層**，與「是否用 LLM 決策」無關。→ 為防封號而上 agentic 操作是用錯理由。
3. **content script 只能送 `isTrusted=false` 合成事件**；`chrome.debugger`/CDP 才能送可信輸入（Claude in Chrome 走後者，代價是偵錯橫幅 + 權限框）。→ 讀用 content script、寫用 content script 起步並留 CDP 縫。

---

## 2. 已鎖定決策

| # | 決策 | 內容 |
|---|---|---|
| D1 路線 | 讀寫都走瀏覽器自動化 | Meta API 當延後的 adapter 縫，不進 MVP |
| D2 拓樸 | Brain / Hands 二分 | 後端=brain（Node/TS 長駐）；extension=hands |
| D3 部署 | MVP 本機，終局中央雲端 | MVP 跑開發者 Mac（`ws://localhost`）；終局 Zeabur 類中央多租戶；遷移=設定+加認證，非重寫 |
| D4 海巡位置 | extension content script | 真實已登入分頁讀 DOM = session/IP/指紋最乾淨 |
| D5 第一前端 | Extension（無聊天介面） | Side Panel 審核台 + Options 設定頁 + content script 隱形的手 |
| D6 執行範式 | B 主 A 備 | B=腳本化手（先做）；A=agentic（延後，扛 UI 改版，**非**防封號）|
| D7 寫入輸入機制 | content script 合成事件起步，CDP 當縫 | actor 抽象「輸入後端」介面；實測遇 isTrusted/React 牆才升級 `chrome.debugger` |
| D8 通道 | **HTTP polling**（SW 用 chrome.alarms 定時拉）| 取最快可行且穩：SW 用 `chrome.alarms`（最小 30s，Chrome 120+）+ 啟動/處理後立即再拉，`fetch` 後端 `GET /poll` 取待辦指令、執行後 `POST /result`。**不需** WS 持久連線/心跳/重連，順應 MV3 事件驅動。內容非即時（排程+人審），30s 延遲無感。SW fetch 不受頁面 CSP 管制（擴充情境）+ host_permissions 免 CORS。**取代** Plan 1 的 WS gateway。派工＝後端把指令入佇列、hands 下次 poll 拉走 |
| D9 海巡迴圈 | 本地、先到先停的 budget | filter 跑 content script；結果可 <10；是取樣非全站排名 |
| D10 儲存 | better-sqlite3 取代 JSON 檔 | tenant-keyed、知識庫版本控管、`review_item→kb_version` 可追溯 |
| D11 知識庫 | 人核心唯讀 + AI 加法 | 後端權威、版本控管；設定頁只是編輯器、資料住後端 |
| D12 reply 產出 | MVP 一稿 + 人 inline 編輯 | 多稿延後 |
| D13 LLM | GPT 系列、品質優先 | 先全用上層 GPT 量成本，判斷步之後最可能下放；orchestrator 強制每篇 Turn/token 上限 |
| D14 retrospective | 延後 Phase 3 | MVP/Phase 2 不做 |
| D15 build 工具 | MVP 棄用 electron-vite | 後端=tsx 直跑；Extension（含審核 UI）=WXT；electron-vite 泊車保留給未來 Electron 前端（A3 終局），不主動維護；`App.tsx` 由 Electron renderer 移植進 WXT side panel |
| D16 設定權限邊界 | 使用者可調 vs 平台內部，嚴格分開 | **使用者可編輯**：AI agent 定義（persona / owned product / marketing strategy / content writing rule）+ 海巡參數（keywords / criteria 讚·時效·篇數·排除）。**平台內部控制、不開放**：反偵測/擬人引擎——cooldown、throttle（每分鐘/單日上限）、jitter、捲動與發文節奏。理由：擬人/防封是產品護城河與賣點，使用者調錯會被封、也會洩漏 know-how；此層中央管理、可持續優化、所有租戶受惠、可自適應（如新帳號更保守），但使用者永不直接設定（未來頂多給包裝過的粗粒度開關）。`business_rules.yaml` 的 `safety` 段歸**內部 config**，不進 `tenant_config` |

---

## 3. 架構：Brain / Hands

```
┌─ 後端 BRAIN（長駐 process，IP 與 Threads 無關）────────────┐
│  排程器 · @openai/agents(LLM loop) · 知識庫+版控 ·          │
│  filter(import) · 🔑LLM key/secrets · queue/history/DB ·    │
│  throttle 狀態 · WS gateway · review-api                    │
└───────────────────────────▲──────────────────────────────┘
        薄通道 WS │ 指令↓(scout/postReply…) 結果↑(原始貼文/成敗)
┌───────────────────────────▼──────────────────────────────┐
│  Chrome Extension HANDS（使用者本人真實 Chrome）            │
│  content script: 讀 DOM / 本地 filter / 打字送出           │
│  side panel: 審核台   ·   options: 設定頁                   │
│  指令詞彙: scout / extractPost / postReply / createPost     │
│           (+ Tier-0: snapshot/click/type/scroll 給未來 A)  │
└───────────────────────────────────────────────────────────┘
   ↑ 真實 session / 住宅 IP / 真實指紋
```

**為什麼中央雲端可行**：危險的 Threads I/O 全在使用者瀏覽器側（真實 IP/session），後端只送指令，故後端位置不影響封號 → 中央多租戶 brain + 分散 hands 成立。

---

## 4. 模組邊界

切分原則：`core` 純邏輯零平台依賴 → adapter 介面化可抽換 → backend/extension 各自組裝。解掉 PoC `pipeline.ts` 邏輯與 I/O 黏死。

**① 共用 `core`（純函式，後端與 content script 皆可 import）**
- `core/types` — 既有型別（ScoutedPost / ReviewItem…）
- `core/filter` — 熱門門檻篩（**跟著 ScoutAdapter 走**：瀏覽器路線跑 content script；未來 API 路線跑後端）
- `core/rules` — hard/soft rule 定義 + 規則檢查
- `core/prompt` — reply / post 的 prompt 組裝
- `core/throttle` — 節流 / budget / jitter 計算

**② Adapters（介面在 core，實作分環境）**
- `ScoutAdapter` — 取候選貼文（impl: extension-DOM；未來 Meta-API）
- `PublisherAdapter` — 發 reply / 發文（impl: extension-DOM；未來 Meta-API）
- `LLMClient` — LLM 呼叫（impl: openai / @openai/agents；吸收 `gpt-5-mini 不收 temperature` 之類差異）
- `Storage` — 持久化（impl: SQLite）
- `SecretStore` — secrets（impl: 後端 env / keychain）

**③ 後端 Brain**
- `orchestrator` — 海巡→filter→LLM→入 queue 的 pipeline（取代糾纏的 pipeline.ts）
- `scheduler` — node-cron 觸發，派工 gated 在 active 連線
- `kb` — 知識庫管理（人核心唯讀 + learned_insights 加法 + 版本控管）
- `gateway` — WS server：派指令、收結果、維護連線註冊（+ 未來 per-tenant 認證縫）
- `review-api` — 提供人審佇列、收 approve/edit/reject、寫入 kb 版本

**④ Extension Hands**
- `content/scout` — 捲動+抓取+本地 filter（用 `core/filter`）
- `content/actor` — Tier-1 動作（postReply/createPost）+ Tier-0 primitives（snapshot/click/type/scroll，給未來 A）；內含**可抽換的「輸入後端」**（合成事件 / 未來 CDP）+ **執行層 humanizer**
- `content/ws-client` — WS 連線 + 指令路由
- `service-worker` — 生命週期、popup/sidepanel、斷線重連
- `ui/review` — 審核面板（複用 PoC `App.tsx`）；`ui/settings` — 設定頁

**跨層契約**：每個 Tier-1 動作回傳 `{ status: ok | fail | element_not_found, payload }`。`element_not_found` 即未來範式 A 的觸發點。

---

## 5. 執行範式與反偵測

**範式 B（MVP）**：selector 寫死的確定性 DOM 操作；LLM 只在「挑貼文 + 寫稿」被呼叫。便宜、穩定。
**範式 A（延後）**：LLM 逐步驅動，扛 UI 改版。loop 一樣跑後端，透過 extension Tier-0 primitives 動手。**價值是 UI 韌性，非防封號。**

**範式 A 之 fallback 範圍（Phase 2）**：採「A 完成任務 + 告警人類」，自動回寫 B（selector self-heal）再延後。MVP 僅先實作 `element_not_found` 失敗訊號這個縫。

**反偵測（封號風險集中在「寫」那半，由本產品自行承擔）**：
- 真實已登入 GUI 分頁動手（最大 factor）。
- 低量 + 人類節奏：`core/throttle` 的 budget / cooldown / jitter。
- LLM 產生多樣化內容（降低文字像 spam）。
- 執行層 humanizer：MVP 先基本 jitter，進階滑鼠曲線/慣性捲動可後續加。
- **已知取捨**：content script 合成事件 `isTrusted=false`，且 React 受控輸入可能需特別處理；遇牆則依 D7 升級 CDP。
- **待實測**：Threads 確切偵測機制無公開資料，上線前須以 PoC 校準。

---

## 6. 資料 / 儲存模型

引擎：`better-sqlite3`（已在 deps）。物件儲存 MVP 不需要（純文字）。

| Table | 取代 | 重點 |
|---|---|---|
| `kb_version` | — | 人核心知識 append-only 版本 + `is_current`；可回滾 |
| `learned_insight` | — | AI 加法洞察，append-only，人可刪 |
| `review_item` | queue.json | kind/target_post/draft/edited_draft/status/rule_flags/時間戳；**外鍵 `kb_version_id`（可追溯哪版產生爛貼文）** |
| `tenant_config` | configs/business_rules.yaml（僅 popular_criteria 等使用者層） | **每租戶各自的海巡設定**：keywords[]、criteria（min_likes/exclude_keywords…）、budget。設定頁 UI 編輯、scout 指令來源。Plan 4 建表。**不含 `safety`（cooldown/throttle）→ 那是平台內部 config，見 D16** |
| `processed_id` | processed_ids.json | 海巡去重 |
| `scout_session` | sessions.json + history.json | session 統計 + 已發歷史 |

全表帶 `tenant_id`（現恆等於 "us"）。後端為唯一權威來源；extension 僅 chrome.storage 非權威快取（UI 偏好 / 連線設定）；secrets 不進此 DB。

---

## 7. 通道設計（HTTP polling）

- **SW 定時拉**：`chrome.alarms`（最小 30s）+ 啟動時 + 處理完指令後立即再拉。每次 `GET /poll?tenant=us` 取待辦指令、本地執行、`POST /result` 回報。
- **為何 polling 而非 WS**：最快可行且穩；不需持久連線/心跳/重連，順應 MV3 事件驅動 SW；產品非即時（排程+人審），30s 延遲無感。
- **CSP/CORS**：SW（擴充情境）的 fetch 不受頁面 CSP 管制；有 `host_permissions` 即免 CORS。content script 的 fetch/WS 才會被頁面 CSP 擋——故通道走 SW。
- **agent loop / 排程邏輯在後端**——SW 只做「定時拉 + 執行 + 回報」。後端把指令入佇列（per-tenant），hands 下次 poll 拉走；後端用「最近 poll 時間」判斷 hands 是否在線。
- 本機 `http://localhost:18900` ↔ 雲端 `https://...` + per-tenant token，差別只在設定，非重寫。
- content script（Plan 3+）經 chrome messaging 收 SW 轉來的指令做 DOM I/O、回傳結果給 SW。

---

## 8. 海巡設計（本地、先到先停）

content script 本地迴圈（零後端、零 LLM）：
```
while (未達任何 budget 上限):
    捲一次（人類節奏 + jitter）
    抓新進 DOM 貼文 → processed 去重
    套確定性門檻（讚/留言/時間，卡片上就有）
    符合者累積進 candidates[]
    if candidates 達目標數: break
湊齊（可能 <10）→ 整批「一次」丟後端做 LLM 判斷+寫稿
```
**Budget 預設（設定頁可調）**：目標候選 10 / 掃描 60 篇 / 捲動 30 次 / 耗時 10 分鐘——任一先到即停。
**心智模型**：取樣，非全站排行。若要「視窗內最熱」，掃固定視窗後本地排序取前 N。
**`min_author_followers`**：追蹤數通常不在卡片上 → 需點進個人頁的「第二段篩」，成本高，**MVP 暫不做**（YAGNI）。

---

## 9. 前端介面面

| 介面 | 用途 | 選型 |
|---|---|---|
| 審核台 | 看 queue、approve/edit/reject、看草稿+目標貼文 | **Side Panel**（非 popup，避免點走即關）|
| 設定頁 | 調參數（門檻/關鍵字/budget）+ 編輯知識 prompt | **Options page** |
| 手 | 讀 DOM / 發文 | content script（隱形）|

**無聊天介面**：意圖事先於設定頁配置，運行模式為「自動海巡 + 人審閘門」。設定頁寫入走 review-api → 後端版本化 kb。LLM key 永不出現在設定頁。

---

## 10. LLM / 成本

LLM 用於：① 撰寫 reply（MVP）② 撰寫品牌貼文（Phase 2）③ 判斷熱門貼文 reply 價值（MVP）④ retrospective（Phase 3）。

策略：GPT 系列、**品質優先起步**（全用上層 GPT）+ instrument 每篇 token → 依數據把「判斷步」下放至便宜 GPT-mini 層。**硬閘門 = orchestrator 強制每篇 Turn/token 上限**。確切 model 名稱於實作時即時查證當下版本/定價再 pin。

---

## 11. MVP 範圍與實作排序

**MVP**：海巡 → reply 草稿 → 人審 → 發。**Phase 2**：原創貼文 + 排程。**Phase 3+**：A fallback self-heal、Meta API adapter、retrospective、中央雲端遷移。

| # | 里程碑 | 證明 |
|---|---|---|
| 1 | 骨架：core/adapter + 後端 gateway(WS) + content script ws-client，hello 指令往返 | brain↔hands 命脈通 |
| 2 | 海巡(B)：content/scout + core/filter 本地迴圈 + budget → 後端收一批候選 | 取樣鏈路 |
| 3 | reply 寫稿：orchestrator + LLMClient + core/prompt + kb 讀 → 產 ReviewItem 入 SQLite；**建 `tenant_config`（per-tenant keywords+criteria），scout 指令改從它讀（取代 env/預設）**；**LLM 相關性判斷：對 scout 候選判斷與關鍵字/品牌是否相關、棄用無關者；不足量則再 scout 補足（refill 迴圈）** | LLM 鏈路（PoC 缺）+ 多租戶條件地基 + 語意相關性 |
| 4 | 審核台：side panel + review-api → approve/edit/reject | 人審閘門 |
| 5 | 發布(B)：content/actor postReply 真實分頁送出 → 記 history + throttle | **閉合 MVP 迴圈** |
| 6 | 設定頁：調參數 + 編輯知識 prompt（寫版本化 kb） | 可運營 |

---

## 12. 明確延後（YAGNI）

- Meta API adapter（保留 ScoutAdapter/PublisherAdapter 縫）
- 範式 A agentic fallback + selector self-heal（保留 `element_not_found` 縫 + Tier-0 primitives）
- CDP/`chrome.debugger` 可信輸入（保留 actor「輸入後端」縫）
- retrospective digest
- 中央雲端多租戶 infra（保留 tenant_id + channel 認證縫）
- 物件儲存（圖片/媒體）
- 版本化 site-adapter 腳本庫
- `min_author_followers` 第二段篩
- reply 多稿

---

## 13. 待實測 / 風險

- Threads 是否檢查 `isTrusted`、React 受控輸入能否以合成事件觸發 → 決定 D7 是否需升級 CDP。
- Threads feed 確切排序/限流/虛擬化行為 → 影響海巡取樣策略。
- 海巡 budget 數值與封號訊號的關係 → 上線後依實測調旋鈕。
- 每篇 token 成本實測 → 決定判斷步是否下放便宜 model。
