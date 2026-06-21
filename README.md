# agent-mkt — Threads AI 行銷小編

幫品牌在 Threads 上做「半自動海巡」與「人工確認後發布回覆」的 AI 小編。整條流程：

```
海巡熱門貼文 → AI 判斷相關性 + 寫 reply 草稿 → 你在側欄人審
                                                    ↓
                                  按「核准」 → AI 自動開啟貼文 + 填入草稿
                                                    ↓
                                      你在 Threads 確認草稿 OK 後親手送出
```

**設計原則：AI 絕對不替你按送出。** 第一階段全程 dry-run（草稿幫你填、最後送出由你決定）。

> 目前狀態：團隊內部 PoC 測試。一個品牌、一個 Threads 帳號，由行銷負責人操作。

---

## 一、第一次安裝（給行銷負責人）

### 你需要先有

- macOS 或 Windows 電腦
- 已登入 Threads 帳號的 Chrome 瀏覽器
- OpenAI API Key（向工程窗口拿）

### 步驟

#### 1. 安裝 Node.js

到 [nodejs.org](https://nodejs.org) 下載安裝 **LTS 版本**（推薦 v22）→ 跟著安裝精靈下一步即可。

驗證：開「終端機」（Mac）或「PowerShell」（Windows），輸入：

```bash
node --version
```

應該看到 `v22.x.x` 或更新的版本。看不到請聯絡工程窗口。

#### 2. 下載專案

```bash
git clone git@github.com:noni2she/agent-mkt.git
cd agent-mkt
```

> 如果沒裝 git，到 [git-scm.com](https://git-scm.com) 下載。

#### 3. 安裝相依套件

```bash
npm install --legacy-peer-deps
```

> 為什麼要加 `--legacy-peer-deps`：相依套件有舊版本衝突，這個旗標讓 npm 用較寬鬆的解析方式。**不加會裝失敗**。

跑完應該看到大量綠色 added 字樣，沒有紅字。

#### 4. 設定 OpenAI API Key

```bash
cp .env.example .env
```

用任何純文字編輯器打開 `.env` 檔（VS Code、TextEdit、記事本都可），找到這行：

```
OPENAI_API_KEY=sk-...
```

把 `sk-...` 換成工程窗口給你的 key（會是 `sk-` 開頭的長字串），存檔。

#### 5. 驗證安裝

```bash
npm run typecheck && npm test
```

最後應該出現 `Tests  26 passed (26)`。出現紅字請聯絡工程窗口。

#### 6. 建構 Chrome 擴充

```bash
npm run ext:build
```

跑完會在 `dist/chrome-mv3/` 目錄出現擴充檔。

#### 7. 安裝 Chrome 擴充

1. 開 Chrome → 網址列輸入 `chrome://extensions`
2. 右上開啟「**開發人員模式**」
3. 左上點「**載入未封裝項目**」
4. 選擇剛才出現的 `dist/chrome-mv3/` 資料夾
5. 擴充應該出現在清單裡，名稱「Agent MKT」

---

## 二、每天怎麼用

### 1. 啟動後端

每次開始使用前，在終端機切到專案目錄：

```bash
cd agent-mkt
npm run backend
```

看到這行就是成功：

```
[poster] 啟動：dryRun=true cooldown=4-11min ...
```

⚠️ **這個終端機視窗要保持開著**。關掉 = 服務停止。

### 2. 開 Threads + 擴充側欄

1. Chrome 開啟並登入 Threads（網址 `threads.com` 或 `threads.net`）
2. 點右上 Chrome 擴充圖示找到「Agent MKT」 → 釘選
3. 點圖示 → 右側出現側欄

### 3. 第一次：完成 Onboarding

首次開啟會跳「Setup Wizard」，請填：
- 品牌名稱
- 品牌簡介（owned product 資訊 — 這是 AI 寫稿最重要的依據，越具體越好）

填完按完成。

### 4. 海巡（找候選貼文）

在側欄「海巡」分頁：
1. 輸入關鍵字（例：「咖啡店」）
2. 設定條件：最少讚數、貼文最新時長
3. 按「開始海巡」

⚠️ 海巡會自動捲動你目前的 Threads 分頁，**捲動期間請不要操作那個分頁**。

幾分鐘後候選會出現在「審核佇列」分頁。

### 5. 人工審核

在「審核佇列」每張卡：
- AI 已經幫你寫好 reply 草稿
- 你可以直接修改草稿文字
- 三個按鈕：
  - **核准** → 進入發送佇列等冷卻
  - **跳過** → 不發

### 6. dry-run 預覽確認（最重要）

核准後等 4–11 分鐘冷卻（防止觸發 Threads 風控的自然節奏），然後：

1. Threads 分頁會**自動切換**到該則貼文
2. 草稿會自動**填入回覆編輯框**（看起來像你正在打字）
3. 側欄該卡狀態變「**預覽中**」（橘色 chip）+ 出現兩顆按鈕：
   - 「確認送出」
   - 「取消發送」

**這時候 AI 已經停下，等你決定**。三種做法都行：

#### A. 你親手在 Threads 按送出（最自然）
直接在 Threads 編輯框按「Reply」送出 → 編輯框會清空 → 系統自動偵測到 → 側欄變「已送出」（約 3 秒內）

#### B. 你在側欄按「確認送出」
等同 A，但是手動標記。**注意：這個按鈕只是更新後端紀錄，不會替你按 Threads 送出**。所以正確順序是：先在 Threads 送出 → 再按側欄這顆。

#### C. 你不想發了
按側欄「取消發送」→ 該則丟進已跳過。

**規則**：**第一篇沒處理完，第二篇不會自動切走**。15 分鐘沒處理會自動標跳過（防止永遠卡住）。

### 7. 處理完一篇 → 下一篇

按完 A/B/C 任一個 → 等下一輪 cooldown（4–11 分鐘）→ Threads 分頁自動切到第二篇 → 重複。

### 8. 停止

不用時把跑著 `npm run backend` 的終端機按 `Ctrl+C` 即可。

---

## 三、設定（進階）

主要設定都在 `.env`。改完要重啟 backend 才生效。

### 我最常會想調的

| 變數 | 意義 | 預設 | 何時改 |
|---|---|---|---|
| `POSTER_DRY_RUN` | `1`=只填草稿不送出、`0`=自動真的送出 | `1` | **保持 `1`！** 等你確認流程穩定、AI 草稿品質夠才考慮改 `0` |
| `POSTER_COOLDOWN_MIN_MIN` / `MAX` | 兩篇之間最少/多分鐘 | `4` / `11` | 想更慢/更謹慎 → 拉長 |
| `POSTER_MAX_PER_SESSION` | 一次最多發幾篇 | `10` | 不放心 → 設 3 |
| `POSTER_PREVIEW_TIMEOUT_MIN` | 預覽中沒處理多久自動跳過 | `15` | 你會離開電腦更久 → 拉長 |
| `SCOUT_TARGET_CANDIDATES` | 一次海巡找幾篇候選 | `10` | 想看更多 → 拉高（會更耗 OpenAI） |

### 重置資料庫（重新走 Onboarding）

```bash
rm -f data/agent-mkt.db data/agent-mkt.db-wal data/agent-mkt.db-shm
```

---

## 四、遇到問題

| 症狀 | 可能原因 | 怎麼辦 |
|---|---|---|
| `npm install` 失敗 | 沒加 `--legacy-peer-deps` | 重跑 `npm install --legacy-peer-deps` |
| 終端機 `command not found: node` | Node 沒裝 / 沒進 PATH | 重新安裝 Node LTS，重開終端機 |
| 海巡跑不出來、Threads 分頁沒動 | 沒開 Threads 分頁、或被換到別的分頁 | 確保有一個 Threads 分頁在前景，重新海巡 |
| 「預覽中」狀態卡了 30 分鐘 | 系統 15 分鐘 timeout 後標 skipped | 重新從審核佇列核准即可 |
| 擴充改了 code 沒生效 | Chrome 擴充需手動 reload | `chrome://extensions` → 點擴充卡片的「重新整理」按鈕 |
| Backend log 出現 `reply trigger not found` | Threads 改版了 DOM 結構 | 截圖+log 傳給工程窗口修選擇器 |

工程窗口聯絡方式：（內部 Slack / Email）

---

## 五、給工程窗口的補充

### 架構

- **後端**（`src/backend/`）：Node + better-sqlite3 + Express HTTP polling，跑在 `localhost:18900`
  - `coordinator.ts` 海巡→reviewer pipeline
  - `reviewer.ts` 用 `@openai/agents`，合併 4 類 agent_def（persona / owned_product / strategy / writing_rule）注入 prompt
  - `poster.ts` 常駐 loop：找 approved → throttle 冷卻 → enqueue `post_reply` → dry-run 改 `previewing` 等人工 resolve、live 直接 sent
  - `store.ts` SQLite schema 全套（review_item / processed_id / tenant_config / agent_def / tenant）

- **擴充**（`entrypoints/`，WXT framework）
  - `background.ts` SW 端 polling，relay `post_reply` 到 content script
  - `content.ts` 在 Threads DOM 上操作（scout 掃卡片、postReply 填草稿、auto-detect editor 變空）
  - `sidepanel/` React + Tailwind v4 UI：SetupWizard / ScoutView / ReviewQueue / KnowledgeView

### 關鍵設計

- **D16 護城河**：scout/poster 節流、目標數、冷卻範圍 集中在 `scoutTuning.ts` / `posterTuning.ts`，`.env` 可覆寫但不開放使用者
- **單一安裝＝單一租戶**（D17）：所有 tenant query 接 `"us"` 常數，真·多租戶推遲
- **dry-run 人工確認閘**：approved → `previewing` → sent/skipped；poster loop 看到 previewing 就停手不抓下一筆（Plan 10a）

### 文件

- `.handoff/session.md` — 隨 repo 走的 session 交接、設計決策、避雷
- `docs/superpowers/plans/` — Plan 1–10a 實作計畫
- `docs/superpowers/specs/` — 設計總綱（D1–D17）
- `docs/design/agent-mkt-design-system/` — Design system handoff

### 驗證

```bash
npm run typecheck && npm test          # 26 tests
npm run ext:build                       # 擴充 build
```

### 後續路線

- **Plan 10b**：後端佈到雲（Fly.io）、bearer token auth、OpenAI key 集中、`/dashboard` web 端、audit log。**等公司 OpenAI 帳號到位再動工。**
- **Plan 11+**：真·多租戶、Threads DOM adapter 集中、選擇器自癒、儀表板。
