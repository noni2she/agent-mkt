# Plan 2: Extension ↔ 後端連通（HTTP polling, e2e hello）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development。Steps 用 checkbox。
>
> **執行紀律（使用者偏好，覆蓋 TDD 預設）**：速度優先、**不要 over-design、只做必要功能**、**不寫前期 unit test**（驗證靠手動 e2e + typecheck/build），測試等 MVP 跑通再補。

**Goal:** 把 Plan 1 的 WS gateway 換成 **HTTP polling** 後端，並用 WXT 建一個最小擴充：SW 用 `chrome.alarms` 定時 `GET /poll` 拉指令、執行 ping→pong、`POST /result` 回報。跨真實瀏覽器證明 brain↔hands 通道打通。

**Architecture:** 後端＝指令佇列 + HTTP server（`GET /poll`、`POST /result`）。擴充 SW 定時拉、執行、回報；不需持久連線/心跳/重連（順應 MV3）。Plan 2 不含 content script（無 DOM 工作）。沿用 `core/protocol.ts` 的 `Command`/`ResponseEnvelope` 形狀。

**Tech Stack:** TypeScript、Node 內建 `http`（零額外 dep）、WXT、既有 `src/core`。

參考：spec D8/§7。**本計畫取代 Plan 1 的 `src/backend/gateway.ts`（WS）**。

---

### Task 1: 後端改為指令佇列 + HTTP polling server（取代 WS gateway）

**Files:**
- Create: `src/backend/commandQueue.ts`
- Create: `src/backend/server.ts`
- Rewrite: `src/backend/main.ts`
- Delete: `src/backend/gateway.ts`、`src/backend/gateway.test.ts`（WS 版已被取代）

- [ ] **Step 1: 建 `src/backend/commandQueue.ts`**

```ts
import { randomUUID } from "node:crypto";
import type { Command, ResponseEnvelope } from "../core/protocol.js";

interface Queued { id: string; command: Command; }
interface Pending {
  resolve: (r: ResponseEnvelope) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

/** per-tenant 指令佇列 + 結果配對。後端入隊、hands poll 拉走、POST 回報。 */
export class CommandQueue {
  private readonly queues = new Map<string, Queued[]>();   // tenant -> 待拉指令
  private readonly awaiting = new Map<string, Pending>();   // command id -> 結果 waiter
  private readonly lastPoll = new Map<string, number>();    // tenant -> 最近 poll 時間（在線判斷）

  /** 後端入隊一個指令，回傳 Promise（hands POST 結果時 resolve，逾時 reject）。 */
  enqueue(tenant: string, command: Command, timeoutMs = 30_000): Promise<ResponseEnvelope> {
    const id = randomUUID();
    const q = this.queues.get(tenant) ?? [];
    q.push({ id, command });
    this.queues.set(tenant, q);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.awaiting.delete(id);
        reject(new Error(`command timeout (${command.action})`));
      }, timeoutMs);
      this.awaiting.set(id, { resolve, reject, timer });
    });
  }

  /** hands 拉走待辦並清空佇列；同時記錄在線時間。 */
  drain(tenant: string): Queued[] {
    this.lastPoll.set(tenant, Date.now());
    const q = this.queues.get(tenant) ?? [];
    this.queues.set(tenant, []);
    return q;
  }

  /** hands 回報結果，resolve 對應的 enqueue Promise。 */
  resolveResult(res: ResponseEnvelope): void {
    const p = this.awaiting.get(res.id);
    if (!p) return;
    clearTimeout(p.timer);
    this.awaiting.delete(res.id);
    p.resolve(res);
  }

  /** tenant 是否近期有 poll（在線）。 */
  isConnected(tenant: string, withinMs = 90_000): boolean {
    const t = this.lastPoll.get(tenant);
    return !!t && Date.now() - t < withinMs;
  }
}
```

- [ ] **Step 2: 建 `src/backend/server.ts`**

```ts
import { createServer, type Server } from "node:http";
import { ResponseEnvelopeSchema } from "../core/protocol.js";
import { CommandQueue } from "./commandQueue.js";

/** 建立 polling HTTP server：GET /poll?tenant=us、POST /result。 */
export function createPollServer(queue: CommandQueue): Server {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", "*"); // 開發便利；正式靠 host_permissions
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

    if (req.method === "GET" && url.pathname === "/poll") {
      const tenant = url.searchParams.get("tenant") ?? "";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(queue.drain(tenant)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/result") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const parsed = ResponseEnvelopeSchema.parse(JSON.parse(body));
        queue.resolveResult(parsed);
        res.statusCode = 204;
        res.end();
      } catch {
        res.statusCode = 400;
        res.end("bad result");
      }
      return;
    }

    res.statusCode = 404;
    res.end();
  });
}
```

- [ ] **Step 3: 改寫 `src/backend/main.ts`**

```ts
import { CommandQueue } from "./commandQueue.js";
import { createPollServer } from "./server.js";

const PORT = Number(process.env.HTTP_PORT ?? 18900);

const queue = new CommandQueue();
const server = createPollServer(queue);

server.listen(PORT, () => {
  console.log(`✅ agent-mkt backend polling server on http://127.0.0.1:${PORT}`);

  if (process.env.WS_DEV_PING === "1") {
    console.log("[dev] WS_DEV_PING：每 5s 入隊一個 ping 給 tenant 'us'");
    setInterval(async () => {
      try {
        const r = await queue.enqueue("us", { action: "ping" }, 20_000);
        console.log("[dev] ping → response:", r.status, r.payload);
      } catch (e) {
        console.log("[dev] ping:", (e as Error).message);
      }
    }, 5_000);
  }
});

const shutdown = () => {
  console.log("\n關閉 server…");
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

- [ ] **Step 4: 刪除 WS gateway**

Run:
```bash
git rm src/backend/gateway.ts src/backend/gateway.test.ts
```

- [ ] **Step 5: typecheck + 既有 core 測試**

Run: `npm run typecheck && npm test`
Expected: typecheck 乾淨；測試剩 core 的（filter/throttle/protocol/adapters，約 21 tests）全 PASS（gateway 測試已移除）。

- [ ] **Step 6: 手動 smoke（curl）**

啟動：`npm run backend`（另開終端）。然後：
```bash
curl -s "http://127.0.0.1:18900/poll?tenant=us"; echo
curl -s -X POST "http://127.0.0.1:18900/result" -H 'content-type: application/json' -d '{"type":"response","id":"x","status":"ok","payload":"pong"}' -w '%{http_code}\n'
```
Expected: 第一個回 `[]`；第二個回 `204`。Ctrl-C 關閉後端。

- [ ] **Step 7: Commit**

```bash
git add src/backend/commandQueue.ts src/backend/server.ts src/backend/main.ts
git commit -m "feat(backend): replace WS gateway with HTTP polling (command queue + /poll + /result)"
```

---

### Task 2: WXT 擴充 — SW 用 chrome.alarms 定時 poll（ping→pong）

**Files:**
- Modify: `package.json`（裝 wxt + ext 腳本）
- Create: `wxt.config.ts`
- Create: `entrypoints/background.ts`
- Modify: `.gitignore`（忽略 `.output/`、`.wxt/`）

- [ ] **Step 1: 裝 WXT + 加腳本**

Run: `npm install -D wxt --legacy-peer-deps`
在 `package.json` `"scripts"` 加：
```json
    "ext:dev": "wxt",
    "ext:build": "wxt build"
```

- [ ] **Step 2: `.gitignore` 忽略 WXT 產物**

確保 `.gitignore` 含：
```
.output
.wxt
```

- [ ] **Step 3: 建 `wxt.config.ts`**

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "agent-mkt hands (dev)",
    permissions: ["alarms"],
    // SW fetch 到 localhost；host_permissions 讓 fetch 免 CORS。
    host_permissions: ["http://localhost/*", "http://127.0.0.1/*"],
  },
});
```

- [ ] **Step 4: 建 `entrypoints/background.ts`**

```ts
// SW 用 chrome.alarms 定時 + 啟動/處理後立即 poll 後端，執行 ping、回 pong。
// 注意：WXT 預設 auto-import defineBackground；若版本需顯式 import，
// 加 `import { defineBackground } from "wxt/utils/define-background";`。
export default defineBackground(() => {
  const TENANT = "us";
  const BASE = "http://127.0.0.1:18900";

  async function pollOnce() {
    let cmds: Array<{ id: string; command: { action: string } }>;
    try {
      const r = await fetch(`${BASE}/poll?tenant=${TENANT}`);
      cmds = await r.json();
    } catch (e) {
      console.log("[hands] poll 失敗（後端沒開？）", (e as Error).message);
      return;
    }
    if (!cmds.length) return;
    for (const { id, command } of cmds) {
      if (command.action === "ping") {
        console.log("[hands] 收到 ping → 回 pong", id);
        await postResult({ type: "response", id, status: "ok", payload: "pong" });
      }
    }
    // 一次拉到指令時，立刻再拉一次，盡快清空 burst
    void pollOnce();
  }

  async function postResult(body: unknown) {
    try {
      await fetch(`${BASE}/result`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.log("[hands] 回報失敗", (e as Error).message);
    }
  }

  // 可靠的定時：chrome.alarms（idle 也會喚醒 SW）。最小 30s。
  chrome.alarms.create("poll", { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === "poll") void pollOnce(); });

  // 啟動先拉一次；另外趁 SW 活著時更頻繁拉，開發體感較快（非保活機制）。
  void pollOnce();
  setInterval(() => void pollOnce(), 5_000);

  console.log("[hands] background 啟動，開始 polling", BASE);
});
```

- [ ] **Step 5: 建置**

Run: `npm run ext:build`
Expected: 成功，產出 `.output/chrome-mv3/`。若 `defineBackground` 未定義，依註解加 import 重建。

- [ ] **Step 6: typecheck（後端不受影響）**

Run: `npm run typecheck`
Expected: 無錯誤（後端 tsconfig 不含 `entrypoints/`）。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json wxt.config.ts entrypoints/background.ts .gitignore
git commit -m "feat(ext): WXT scaffold + SW polling client (ping/pong)"
```

---

### Task 3: 端到端手動驗證（跨真實瀏覽器）

**Files:** 無（純驗證）

- [ ] **Step 1: 啟動後端（開 dev ping）**

Run: `WS_DEV_PING=1 npm run backend`
Expected: 印 `✅ ... polling server on http://127.0.0.1:18900` 與 `[dev] WS_DEV_PING…`。此時 ping 入隊但還沒人拉，會在 20s 後印 `[dev] ping: command timeout (ping)`（正常，因為擴充還沒載）。

- [ ] **Step 2: 載入未封裝擴充**（本機 Chrome，需人工操作）

1. 開 `chrome://extensions` → 開「開發人員模式」
2. 「載入未封裝」→ 選 repo 的 `.output/chrome-mv3/`
3. 點擴充的「service worker」連結開 console

- [ ] **Step 3: 觀察兩側（成功判準）**

- SW console：`[hands] background 啟動，開始 polling …`，接著每幾秒 `[hands] 收到 ping → 回 pong <id>`
- 後端 console：從 timeout 轉成每 5s 印 `[dev] ping → response: ok pong`

**通過條件**：後端持續印 `ping → response: ok pong` 且 SW 印 `收到 ping → 回 pong`，代表 SW↔後端 HTTP polling 通道端到端打通。

- [ ] **Step 4: 失敗排查**

- SW console 出現 CORS/連線錯誤 → 確認 `host_permissions` 含 `http://127.0.0.1/*`，重建重載。
- 後端一直 timeout → 確認擴充已載入且 SW console 有 polling log；確認後端在 18900。
- 把兩側 log 摘錄進報告。

- [ ] **Step 5: 記錄結果**（無需 commit）報告附兩側 log 摘錄與結論。

---

## Self-Review

**Spec coverage：** D8/§7（HTTP polling、chrome.alarms、免 CORS via host_permissions、後端佇列、gated on 最近 poll）→ Task 1 佇列+server + Task 2 SW poller ✅。e2e hello → Task 3 ✅。沿用 `core/protocol` 的 `Command`/`ResponseEnvelope` ✅。

**YAGNI / 不 over-design：** 用 Node 內建 http（零 dep）；無 content script、側欄、core 匯入、心跳、重連、持久連線；無前期 unit test。刪除被取代的 WS gateway，不留死碼。

**No placeholder：** 每步含完整檔案內容與精確指令；手動步驟給逐步操作與成功判準。

**一致性：** SW POST 的 `{type:"response", id, status, payload}` 符合 `ResponseEnvelopeSchema`；後端 `enqueue` 的 `{action:"ping"}` 符合 `CommandSchema`；server 用 `ResponseEnvelopeSchema.parse` 驗證；main 用 `CommandQueue.enqueue`。

---

## 後續（不在本檔）

- **Plan 3**：content script + chrome messaging（SW↔content script 轉發）+ 海巡(B)：捲動抓取 + 本地 `core/filter` + budget + `scout` 指令（此時把 `core` 匯入擴充建置）。
- 之後：reply 寫稿（後端 LLM）、審核台側欄、發布(B)。
