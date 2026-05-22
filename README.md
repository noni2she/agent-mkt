# agent-mkt — AI 小編 Agent for Threads（PoC）

非商業化 PoC。驗證兩件事：
1. **Module A**：能否複製特定小編文筆/留言風格
2. **Module B**：能否在「半自動 + 人類審核」流程下安全回覆 popular 文章

> ⚠️ 僅限自有測試帳號。送出動作一律由人類在審核台觸發，AI 不自動送出。

## 架構

```
modules/style_engine/       Module A：persona / extractor / generator (OpenAI SDK)
modules/threads_interaction/ Module B：browser / scout / throttle / poster (Playwright+stealth)
modules/pipeline.ts          海巡→判定→生成→進佇列（不含送出）
electron/                    main + preload（IPC：審核、送出由人觸發）
renderer/review/             React 審核台（防疲勞設計）
scheduler/                   node-cron（預設關閉自動海巡）
shared/                      types / config(YAML) / store(JSON 記憶層)
configs/                     persona / business_rules
```

## 安裝與執行

```bash
cd ~/wit/agent-mkt
npm install
cp .env.example .env          # 填 OPENAI_API_KEY
npm run playwright:install    # 安裝 chromium

# 1. 首次手動登入測試帳號（持久化到 .playwright-profile）
#    執行海巡時若未登入會中止並回報 not_logged_in
npm run scout                 # CLI 驗證 Module B（不開 Electron）

# 2. 開審核台逐條人工審核 + 送出
npm run dev
```

## 設計重點

- **送出永遠人觸發**：`poster.ts` 有 SafetyError 多重護欄，未審核/命中硬規則/缺上下文一律拒送
- **防偵測**：headed 模式 + stealth + persistent context + 隨機節奏（`throttle.ts`），不用固定頻率
- **防審核疲勞**：強制顯示原文、逐條操作、無「全部通過」、通過率 ≥95% 警示

## Selector 校正（重要）

Threads DOM 無公開穩定 selector。`scout.ts` / `poster.ts` 的 selector 為起手值，
首次跑前用 Playwright Inspector 對照實際 DOM 校正：

```bash
PWDEBUG=1 npm run scout
```

校正點：搜尋框、貼文卡片、貼文文字、互動數 aria-label、回覆框、發佈鈕。

## PoC 出場指標

見 `~/.claude/plans/ai-agent-mossy-perlis.md`（已核准計畫）。

## 注意

- 與 `~/wit/threads-manager`（API-based 多帳號商業系統）路線不同、互補。
  風格引擎邏輯日後可互相參考。
- PoC 通過後再評估：Threads API 混合架構、商業形態、多帳號隔離、計費、法遵。
