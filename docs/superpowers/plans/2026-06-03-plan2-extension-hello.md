# Plan 2: Extension SW ↔ 後端連通（e2e hello）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **執行紀律（使用者偏好，覆蓋 TDD 預設）**：速度優先做 MVP、**不要 over-design、只做必要功能**、**不寫前期 unit test**（驗證靠手動 e2e + typecheck/build），測試等 MVP 跑通再補。

**Goal:** 用 WXT 建一個最小 Chrome 擴充，其 **service worker** 連上 Plan 1 的後端 WS gateway、自報 hello、並回覆 ping→pong，跨真實瀏覽器證明 brain↔hands 通道（CSP-safe）打通。

**Architecture:** WS 掛在 **service worker**（不受頁面 CSP 管制；Threads 會擋 content script 的 WS）。SW 持 WS + 心跳 keep-alive（Chrome 116+ WS 訊息重置 idle timer）+ 斷線重連。Plan 2 不含 content script（無 DOM 工作）。後端加一個 env-gated dev-ping 來觸發往返驗證。

**Tech Stack:** WXT（2026 MV3 主流建置）、TypeScript、既有後端 `src/backend`（tsx）。

參考：`docs/superpowers/specs/2026-06-02-agent-mkt-redesign-design.md`（D8 通道、§7）。

---

### Task 1: WXT 擴充骨架 + service worker WS client（hello + ping→pong）

**Files:**
- Modify: `package.json`（加 wxt 依賴與 ext 腳本）
- Create: `wxt.config.ts`（repo 根，與後端共用單一 package.json）
- Create: `entrypoints/background.ts`

- [ ] **Step 1: 裝 WXT**

Run:
```bash
npm install -D wxt --legacy-peer-deps
```
（`--legacy-peer-deps` 因 repo 既有 zod peer 衝突，與本任務無關。）

- [ ] **Step 2: 加 ext 腳本**

在 `package.json` `"scripts"` 加：
```json
    "ext:dev": "wxt",
    "ext:build": "wxt build"
```

- [ ] **Step 3: 建 `wxt.config.ts`（repo 根目錄）**

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "agent-mkt hands (dev)",
    // SW 連 ws://localhost 給後端。若 manifest 驗證拒絕 ws scheme，
    // 改用 http 形式或移除此行（SW 連 localhost 多半無需 host_permission）— 以實測為準。
    host_permissions: ["ws://localhost/*", "http://localhost/*"],
  },
});
```

- [ ] **Step 4: 建 `entrypoints/background.ts`**

```ts
// SW 持 WS 連後端 gateway，自報 hello、回覆 ping→pong，心跳 keep-alive + 斷線重連。
// 注意：WXT 預設 auto-import defineBackground；若你的 WXT 版本需顯式 import，
// 加上 `import { defineBackground } from "wxt/utils/define-background";`。
export default defineBackground(() => {
  const TENANT = "us";
  const URL = "ws://localhost:18900";
  let ws: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  function connect() {
    ws = new WebSocket(URL);

    ws.addEventListener("open", () => {
      console.log("[hands] connected → hello");
      ws!.send(JSON.stringify({ type: "hello", tenant: TENANT }));
      heartbeat = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat" })); // keep SW alive；後端會忽略
        }
      }, 20_000);
    });

    ws.addEventListener("message", (ev) => {
      let msg: { type?: string; id?: string; command?: { action?: string } };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.type === "request" && msg.command?.action === "ping") {
        console.log("[hands] ping → pong", msg.id);
        ws!.send(JSON.stringify({ type: "response", id: msg.id, status: "ok", payload: "pong" }));
      }
    });

    ws.addEventListener("close", () => {
      console.log("[hands] disconnected → retry in 3s");
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      setTimeout(connect, 3_000);
    });

    ws.addEventListener("error", () => ws?.close());
  }

  connect();
});
```

- [ ] **Step 5: 建置擴充**

Run: `npm run ext:build`
Expected: 成功，產出 `.output/chrome-mv3/`（含 manifest.json + background）。若 `defineBackground` 未定義導致建置失敗，依 Step 4 註解加上顯式 import，再重建。

- [ ] **Step 6: typecheck（後端不受影響）**

Run: `npm run typecheck`
Expected: 無錯誤（後端 tsconfig include 僅 `src`/`scripts`，不含 `entrypoints/`，故擴充碼不被後端 tsc 編譯）。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json wxt.config.ts entrypoints/background.ts
git commit -m "feat(ext): WXT scaffold + SW WS client (hello + ping/pong)"
```
（勿 commit `.output/`、`.wxt/`；若它們出現在 git status，加進 `.gitignore` 並一併 commit。）

---

### Task 2: 後端 dev-ping 驗證鉤子（env-gated，僅 main.ts）

**Files:**
- Modify: `src/backend/main.ts`

- [ ] **Step 1: 在 main.ts 加 env-gated dev ping**

在 `main()` 內、`console.log("✅ ...")` 那行之後，插入：
```ts
  if (process.env.WS_DEV_PING === "1") {
    console.log("[dev] WS_DEV_PING 開啟：每 5s 對 tenant 'us' 送 ping");
    setInterval(async () => {
      if (!gw.isConnected("us")) {
        console.log("[dev] 等待 hands 連線…");
        return;
      }
      try {
        const r = await gw.sendCommand("us", { action: "ping" }, 3_000);
        console.log("[dev] ping → response:", r.status, r.payload);
      } catch (e) {
        console.log("[dev] ping 失敗:", (e as Error).message);
      }
    }, 5_000);
  }
```
不改動其他邏輯。此區塊僅在 `WS_DEV_PING=1` 時啟用，生產啟動不受影響。

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 無錯誤。

- [ ] **Step 3: 確認既有後端測試未壞**

Run: `npm test`
Expected: 27 tests 全 PASS（dev-ping 只在 runtime env 開啟，不影響測試）。

- [ ] **Step 4: Commit**

```bash
git add src/backend/main.ts
git commit -m "feat(backend): env-gated dev ping for e2e hello verification"
```

---

### Task 3: 端到端手動驗證（hello + ping→pong 跨真實瀏覽器）

**Files:** 無（純驗證；產出一份驗證記錄附在報告）

- [ ] **Step 1: 啟動後端（開 dev ping）**

Run（前景或背景）: `WS_DEV_PING=1 npm run backend`
Expected: 印出 `✅ ... listening on ws://127.0.0.1:18900` 與 `[dev] WS_DEV_PING 開啟…`，接著每 5s 印 `[dev] 等待 hands 連線…`（因為還沒載入擴充）。

- [ ] **Step 2: 載入未封裝擴充**

手動（無法用程式自動化，請人工或實作者在本機 Chrome 操作）：
1. 開 `chrome://extensions`
2. 右上開「開發人員模式 / Developer mode」
3. 「載入未封裝 / Load unpacked」→ 選 repo 的 `.output/chrome-mv3/`
4. 擴充出現後，點它的「service worker」連結開啟 DevTools console

- [ ] **Step 3: 觀察兩側 log（成功判準）**

- 擴充 SW console 應出現：`[hands] connected → hello`，接著每次後端 ping 出現 `[hands] ping → pong <id>`
- 後端 console 應從 `[dev] 等待 hands 連線…` 變成每 5s 印 `[dev] ping → response: ok pong`

**通過條件**：後端持續印 `ping → response: ok pong` 且 SW console 印 `ping → pong`，代表 SW↔後端 通道（CSP-safe）端到端打通。

- [ ] **Step 4: 若失敗的排查**

- SW console 出現 CSP/連線錯誤 → 確認 `host_permissions` 是否需要調整（試移除 ws scheme、或改 `http://localhost/*`），重建擴充重載。
- 後端一直 `等待 hands 連線` → 確認後端在 18900、擴充 URL 一致、Chrome 允許連 localhost。
- 把實際觀察到的兩側 log 摘錄進報告。

- [ ] **Step 5: 記錄驗證結果**

無需 commit。在實作報告中附上兩側 log 摘錄與通過/失敗結論。

---

## Self-Review

**Spec coverage：** D8/§7 更新後的通道（WS 在 SW、CSP-safe、心跳、gated 在連線）→ Task 1 SW client + 心跳 + 重連 ✅。e2e hello（ping→pong 跨真實瀏覽器）→ Task 3 ✅。後端側觸發 → Task 2 dev-ping ✅。

**YAGNI / 不 over-design：** 不含 content script（無 DOM 工作）、不含 side panel/設定頁、不含 core 匯入（留 Plan 3 filter 需要時再證明 core 可共用）、不寫前期 unit test、dev-ping env-gated 不污染生產。

**No placeholder：** 每步有完整檔案內容與精確指令；手動步驟（載入擴充、看 console）本質無法自動化，已給逐步操作與成功判準。

**一致性：** SW 送的 `hello`/`response` 形狀與 Plan 1 `core/protocol.ts` 的 `HelloSchema`/`ResponseEnvelopeSchema` 一致；`request`+`command.action==="ping"` 與 `RequestEnvelopeSchema`+`CommandSchema` 一致；後端 dev-ping 用既有 `gw.isConnected`/`gw.sendCommand`。

---

## 後續（不在本檔）

- **Plan 3**：content script + chrome messaging（SW↔content script 轉發）+ 海巡(B)：捲動抓取 + 本地 `core/filter` 迴圈 + budget + `scout` 指令（此時才把 `core` 匯入擴充建置、證明共用）。
- 之後：reply 寫稿、審核台、發布(B)。
