# Plan 1: 地基骨架（Brain core + WS Gateway）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立重設計的後端地基——把 PoC 的純邏輯抽成可測的 `core`、定義 brain↔hands 的 WS 協定與 adapter 介面、實作一個可對 mock client 測試的後端 WS gateway。

**Architecture:** 單一 package.json，TypeScript ESM。`src/core` 放零平台依賴的純邏輯與型別、協定、adapter 介面（後端與未來 extension 共用）。`src/backend` 放 brain；本計畫只做 `gateway`（WS server：連線註冊 + 帶 correlation id 的請求/回應），用真實 `ws` client 在 vitest 內測試。Extension hands 與端到端 hello 屬 Plan 2。

**Tech Stack:** TypeScript (ESNext modules), vitest（測試）, ws（WebSocket server）, zod（已有，協定驗證）, tsx（已有，跑後端）。

參考設計稿：`docs/superpowers/specs/2026-06-02-agent-mkt-redesign-design.md`（§4 模組邊界、§7 通道）。

---

### Task 1: 安裝測試/WS 依賴並建立 vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/core/smoke.test.ts`（暫時，驗證 vitest 可跑，Task 2 後刪）

- [ ] **Step 1: 安裝依賴**

Run:
```bash
npm install -D vitest@^3 && npm install ws@^8 && npm install -D @types/ws@^8
```
Expected: 安裝成功，`package.json` 出現 `vitest`、`ws`、`@types/ws`。

- [ ] **Step 2: 加 test script**

修改 `package.json` 的 `"scripts"`，新增：
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: 建 vitest.config.ts**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: 寫 smoke 測試確認框架可跑**

Create `src/core/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS，1 passed。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/core/smoke.test.ts
git commit -m "chore: add vitest + ws deps and test harness"
```

---

### Task 2: 抽取 core/types

**Files:**
- Create: `src/core/types.ts`
- Delete: `src/core/smoke.test.ts`（不再需要）

- [ ] **Step 1: 建 core/types.ts**

把 `src/shared/types.ts` 的全部內容複製到新檔 `src/core/types.ts`（內容不變，僅換位置；它零依賴）。新檔開頭註解改為：
```ts
// 跨 core / backend / extension 共用型別（原 src/shared/types.ts）
```
其餘 `Persona`、`BusinessRules`、`ScoutedPost`、`ReviewStatus`、`ReviewItem`、`SessionStats` 介面照舊。

- [ ] **Step 2: 刪除 smoke 測試**

Run: `rm src/core/smoke.test.ts`

- [ ] **Step 3: typecheck 確認無誤**

Run: `npm run typecheck`
Expected: 無錯誤（新檔自洽、未被 import 不影響舊碼）。

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts
git commit -m "refactor: add core/types (platform-independent shared types)"
```

---

### Task 3: 抽取並測試 core/filter

**Files:**
- Create: `src/core/filter.ts`
- Test: `src/core/filter.test.ts`

- [ ] **Step 1: 寫失敗測試**

Create `src/core/filter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseCount, isPopular } from "./filter.js";
import type { BusinessRules, ScoutedPost } from "./types.js";

const rules: BusinessRules = {
  hard_rules: [],
  soft_rules: [],
  popular_criteria: {
    min_likes: 100,
    min_replies: 50,
    max_post_age_hours: 24,
    min_author_followers: 0,
    scout_target_per_keyword: 10,
    topic_keywords: [],
    exclude_keywords: ["業配"],
  },
  safety: {
    require_human_approval_before_send: true,
    max_replies_per_session: 10,
    cooldown_minutes_between_replies: [3, 8],
  },
};

const base: Omit<ScoutedPost, "is_popular" | "popular_reason"> = {
  id: "1",
  url: "u",
  author_handle: "a",
  author_followers: null,
  text: "正常內容",
  likes: 200,
  replies: 80,
  posted_at: new Date().toISOString(),
  thread_excerpt: [],
};

describe("parseCount", () => {
  it("parses plain numbers and commas", () => {
    expect(parseCount("1,234")).toBe(1234);
  });
  it("parses 萬 and k units", () => {
    expect(parseCount("1.5萬")).toBe(15000);
    expect(parseCount("2k")).toBe(2000);
  });
  it("returns 0 for null", () => {
    expect(parseCount(null)).toBe(0);
  });
});

describe("isPopular", () => {
  it("accepts a post over thresholds", () => {
    expect(isPopular(base, rules).ok).toBe(true);
  });
  it("rejects low likes", () => {
    expect(isPopular({ ...base, likes: 10 }, rules).ok).toBe(false);
  });
  it("rejects excluded keyword", () => {
    expect(isPopular({ ...base, text: "這是業配文" }, rules).ok).toBe(false);
  });
  it("rejects old posts", () => {
    const old = new Date(Date.now() - 48 * 3600_000).toISOString();
    expect(isPopular({ ...base, posted_at: old }, rules).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/core/filter.test.ts`
Expected: FAIL，找不到 `./filter.js`。

- [ ] **Step 3: 建 core/filter.ts**

Create `src/core/filter.ts`（從 `src/skills/scout/filter.ts` 移植，只改 import 路徑指向同目錄 types）:
```ts
import type { BusinessRules, ScoutedPost } from "./types.js";

export function parseCount(s: string | null): number {
  if (!s) return 0;
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([萬kKwW]?)/);
  if (!m) return 0;
  const n = parseFloat(m[1] ?? "0");
  const unit = (m[2] ?? "").toLowerCase();
  if (unit === "萬" || unit === "w") return Math.round(n * 10000);
  if (unit === "k") return Math.round(n * 1000);
  return Math.round(n);
}

/** Popular 判定：海巡路線共用，確保一致性 */
export function isPopular(
  p: Omit<ScoutedPost, "is_popular" | "popular_reason">,
  rules: BusinessRules,
): { ok: boolean; reason: string } {
  const c = rules.popular_criteria;
  const ageH = (Date.now() - new Date(p.posted_at).getTime()) / 3600_000;
  const reasons: string[] = [];
  if (p.likes < c.min_likes) return { ok: false, reason: `讚數不足(${p.likes})` };
  if (p.replies < c.min_replies) return { ok: false, reason: `留言不足(${p.replies})` };
  if (ageH > c.max_post_age_hours) return { ok: false, reason: `太舊(${Math.round(ageH)}h)` };
  if (c.exclude_keywords.some((k) => p.text.includes(k)))
    return { ok: false, reason: "命中排除關鍵字" };
  reasons.push(`👍${p.likes}/💬${p.replies}`, `${Math.round(ageH)}h內`);
  return { ok: true, reason: `popular: ${reasons.join(" ")}` };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/core/filter.test.ts`
Expected: PASS，所有測試通過。

- [ ] **Step 5: Commit**

```bash
git add src/core/filter.ts src/core/filter.test.ts
git commit -m "refactor: add tested core/filter (popularity threshold logic)"
```

---

### Task 4: 抽取並測試 core/throttle

**Files:**
- Create: `src/core/throttle.ts`
- Test: `src/core/throttle.test.ts`

- [ ] **Step 1: 寫失敗測試**

Create `src/core/throttle.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { randInt, jitter, SessionThrottle } from "./throttle.js";

describe("randInt", () => {
  it("stays within [min,max] over many runs", () => {
    for (let i = 0; i < 1000; i++) {
      const v = randInt(3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
    }
  });
});

describe("jitter", () => {
  it("never returns below the 150ms floor", () => {
    for (let i = 0; i < 1000; i++) {
      expect(jitter(100)).toBeGreaterThanOrEqual(150);
    }
  });
  it("stays near the mean within the spread band", () => {
    for (let i = 0; i < 1000; i++) {
      const v = jitter(1000, 0.4);
      expect(v).toBeGreaterThanOrEqual(150);
      expect(v).toBeLessThanOrEqual(1800); // mean*(1+spread) 上界
    }
  });
});

describe("SessionThrottle.sessionExpired", () => {
  it("is false right after construction", () => {
    const t = new SessionThrottle(10, 1, [3, 8]);
    expect(t.sessionExpired()).toBe(false);
  });
  it("is true when max hours is zero", () => {
    const t = new SessionThrottle(10, 0, [3, 8]);
    expect(t.sessionExpired()).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/core/throttle.test.ts`
Expected: FAIL，找不到 `./throttle.js`。

- [ ] **Step 3: 建 core/throttle.ts**

Create `src/core/throttle.ts`（從 `src/workflow/throttle.ts` 原樣移植，內容零依賴、不需改 import）：
```ts
// 行為節流 + 人類節奏模擬。固定頻率本身就是機器人訊號 → 全程隨機分佈。

/** 隨機整數 [min, max] */
export const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** 高斯擾動，模擬人類停頓而非均勻分佈 */
export function jitter(meanMs: number, spread = 0.4): number {
  const g = (Math.random() + Math.random() + Math.random()) / 3; // 近似常態
  const factor = 1 + (g - 0.5) * 2 * spread;
  return Math.max(150, Math.round(meanMs * factor));
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** 人類化短暫停頓（讀內容、思考） */
export const humanPause = (meanMs = 1800): Promise<void> => sleep(jitter(meanMs));

/** Session 級節流器：限制每分鐘瀏覽量 + 單日活動時數 + 留言冷卻。 */
export class SessionThrottle {
  private viewTimestamps: number[] = [];
  private lastReplyAt = 0;
  private readonly startedAt = Date.now();

  constructor(
    private readonly maxPerMin: number,
    private readonly sessionMaxHours: number,
    private readonly replyCooldownMinRange: [number, number],
  ) {}

  sessionExpired(): boolean {
    return Date.now() - this.startedAt > this.sessionMaxHours * 3600_000;
  }

  async gateView(): Promise<void> {
    const now = Date.now();
    this.viewTimestamps = this.viewTimestamps.filter((t) => now - t < 60_000);
    if (this.viewTimestamps.length >= this.maxPerMin) {
      const waitMs = 60_000 - (now - this.viewTimestamps[0]!) + jitter(2000);
      await sleep(waitMs);
    }
    this.viewTimestamps.push(Date.now());
    await humanPause();
  }

  async gateReply(): Promise<void> {
    const [lo, hi] = this.replyCooldownMinRange;
    const since = Date.now() - this.lastReplyAt;
    const need = randInt(lo * 60_000, hi * 60_000);
    if (this.lastReplyAt && since < need) await sleep(need - since);
    this.lastReplyAt = Date.now();
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/core/throttle.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/core/throttle.ts src/core/throttle.test.ts
git commit -m "refactor: add tested core/throttle (cadence + human pacing)"
```

---

### Task 5: 定義並測試 brain↔hands 協定（core/protocol）

**Files:**
- Create: `src/core/protocol.ts`
- Test: `src/core/protocol.test.ts`

說明：協定是後端與 extension 之間每則 WS 訊息的契約。本計畫只放 Plan 1 需要的 `ping` 指令與通用 envelope（帶 correlation id）；scout / postReply 等指令於後續計畫擴充 discriminated union。用 zod 在邊界驗證。

- [ ] **Step 1: 寫失敗測試**

Create `src/core/protocol.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseClientMessage, RequestEnvelope } from "./protocol.js";

describe("parseClientMessage", () => {
  it("parses a hello message", () => {
    const msg = parseClientMessage(JSON.stringify({ type: "hello", tenant: "us" }));
    expect(msg).toEqual({ type: "hello", tenant: "us" });
  });
  it("parses a response envelope", () => {
    const raw = JSON.stringify({ type: "response", id: "abc", status: "ok", payload: "pong" });
    const msg = parseClientMessage(raw);
    expect(msg).toEqual({ type: "response", id: "abc", status: "ok", payload: "pong" });
  });
  it("throws on malformed json", () => {
    expect(() => parseClientMessage("{not json")).toThrow();
  });
  it("throws on unknown shape", () => {
    expect(() => parseClientMessage(JSON.stringify({ foo: 1 }))).toThrow();
  });

  it("builds a ping request envelope", () => {
    const env: RequestEnvelope = { type: "request", id: "x", command: { action: "ping" } };
    expect(env.command.action).toBe("ping");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/core/protocol.test.ts`
Expected: FAIL，找不到 `./protocol.js`。

- [ ] **Step 3: 建 core/protocol.ts**

Create `src/core/protocol.ts`:
```ts
import { z } from "zod";

/** 後端 → hands 的指令。Plan 1 僅 ping；後續計畫擴充此 union。 */
export const CommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ping") }),
]);
export type Command = z.infer<typeof CommandSchema>;

/** 後端 → hands：包住一個指令，帶 correlation id。 */
export const RequestEnvelopeSchema = z.object({
  type: z.literal("request"),
  id: z.string(),
  command: CommandSchema,
});
export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;

/** hands → 後端：連線時自報租戶。 */
export const HelloSchema = z.object({
  type: z.literal("hello"),
  tenant: z.string(),
});
export type Hello = z.infer<typeof HelloSchema>;

/** hands → 後端：對某個 request 的回應。 */
export const ResponseEnvelopeSchema = z.object({
  type: z.literal("response"),
  id: z.string(),
  status: z.enum(["ok", "fail", "element_not_found"]),
  payload: z.unknown().optional(),
  error: z.string().optional(),
});
export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;

/** hands → 後端 的所有合法訊息。 */
export const ClientMessageSchema = z.union([HelloSchema, ResponseEnvelopeSchema]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** 解析並驗證一則來自 hands 的訊息；非法則 throw。 */
export function parseClientMessage(raw: string): ClientMessage {
  const json = JSON.parse(raw) as unknown;
  return ClientMessageSchema.parse(json);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/core/protocol.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/core/protocol.ts src/core/protocol.test.ts
git commit -m "feat: add core/protocol (brain<->hands WS message contract)"
```

---

### Task 6: 定義 adapter 介面（core/adapters）

**Files:**
- Create: `src/core/adapters.ts`
- Test: `src/core/adapters.test.ts`

說明：adapter 介面是型別，靠一個 in-memory 測試替身證明介面可被實作與使用。Plan 1 只需 `Storage` 與 `SecretStore` 的最小形狀 + scout/publish 的佔位介面（後續計畫補方法）。

- [ ] **Step 1: 寫失敗測試**

Create `src/core/adapters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { Storage, SecretStore } from "./adapters.js";

class MemStorage implements Storage {
  private m = new Map<string, string>();
  async get(key: string) { return this.m.get(key) ?? null; }
  async set(key: string, value: string) { this.m.set(key, value); }
}

class EnvSecrets implements SecretStore {
  constructor(private env: Record<string, string>) {}
  async getSecret(name: string) { return this.env[name] ?? null; }
}

describe("adapter interfaces are implementable", () => {
  it("Storage round-trips", async () => {
    const s: Storage = new MemStorage();
    await s.set("k", "v");
    expect(await s.get("k")).toBe("v");
    expect(await s.get("missing")).toBeNull();
  });
  it("SecretStore reads", async () => {
    const s: SecretStore = new EnvSecrets({ OPENAI_API_KEY: "sk-x" });
    expect(await s.getSecret("OPENAI_API_KEY")).toBe("sk-x");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/core/adapters.test.ts`
Expected: FAIL，找不到 `./adapters.js`。

- [ ] **Step 3: 建 core/adapters.ts**

Create `src/core/adapters.ts`:
```ts
import type { ScoutedPost } from "./types.js";

/** 鍵值持久化（impl: SQLite / in-memory）。 */
export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** 機密讀取（impl: 後端 env / keychain）。永遠不在 extension 實作。 */
export interface SecretStore {
  getSecret(name: string): Promise<string | null>;
}

/** 取候選貼文（impl: extension-DOM；未來 Meta-API）。後續計畫補方法簽章。 */
export interface ScoutAdapter {
  /** 回傳一批候選（尚未經 LLM 判斷）。keyword 為海巡關鍵字。 */
  scout(keyword: string): Promise<ScoutedPost[]>;
}

/** 發 reply / 發文（impl: extension-DOM；未來 Meta-API）。 */
export interface PublisherAdapter {
  postReply(url: string, text: string): Promise<void>;
  createPost(text: string): Promise<void>;
}

/** LLM 呼叫（impl: openai / @openai/agents）。吸收各 model 能力差異。 */
export interface LLMClient {
  complete(prompt: string): Promise<string>;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/core/adapters.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/core/adapters.ts src/core/adapters.test.ts
git commit -m "feat: add core/adapters (swappable adapter interfaces)"
```

---

### Task 7: 後端 WS Gateway（連線註冊 + 請求/回應）

**Files:**
- Create: `src/backend/gateway.ts`
- Test: `src/backend/gateway.test.ts`

說明：Gateway 開一個 WS server，hands 連入後送 `hello` 註冊（依 tenant）。`sendCommand(tenant, command)` 產生 correlation id、送 request、回傳 Promise，待對應 `response` 解析或逾時 reject。測試用真實 `ws` client 模擬 hands。

- [ ] **Step 1: 寫失敗測試**

Create `src/backend/gateway.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import WebSocket from "ws";
import { Gateway } from "./gateway.js";
import { parseClientMessage } from "../core/protocol.js";

let gw: Gateway;
afterEach(async () => { await gw?.close(); });

/** 啟一個假 hands：連入、hello、對 ping 回 pong。 */
function fakeHands(port: number, tenant: string): Promise<WebSocket> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on("open", () => ws.send(JSON.stringify({ type: "hello", tenant })));
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === "request" && msg.command.action === "ping") {
        ws.send(JSON.stringify({ type: "response", id: msg.id, status: "ok", payload: "pong" }));
      }
    });
    ws.on("open", () => setTimeout(() => resolve(ws), 50));
  });
}

describe("Gateway", () => {
  it("dispatches a command to a registered tenant and resolves the response", async () => {
    gw = new Gateway(0);
    const port = await gw.listen();
    const hands = await fakeHands(port, "us");

    const res = await gw.sendCommand("us", { action: "ping" }, 2000);
    expect(res.status).toBe("ok");
    expect(res.payload).toBe("pong");
    hands.close();
  });

  it("rejects when tenant has no connection", async () => {
    gw = new Gateway(0);
    await gw.listen();
    await expect(gw.sendCommand("nobody", { action: "ping" }, 500)).rejects.toThrow(/no connection/i);
  });

  it("rejects on timeout when hands never responds", async () => {
    gw = new Gateway(0);
    const port = await gw.listen();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on("open", () => { ws.send(JSON.stringify({ type: "hello", tenant: "silent" })); setTimeout(r, 50); }));
    await expect(gw.sendCommand("silent", { action: "ping" }, 300)).rejects.toThrow(/timeout/i);
    ws.close();
  });

  it("ignores malformed client messages without crashing", async () => {
    gw = new Gateway(0);
    const port = await gw.listen();
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((r) => ws.on("open", r));
    ws.send("{not json");
    // 仍能正常服務其他連線
    const hands = await fakeHands(port, "us");
    const res = await gw.sendCommand("us", { action: "ping" }, 2000);
    expect(res.payload).toBe("pong");
    ws.close(); hands.close();
  });
});

// 確保 parseClientMessage 真的被 gateway 用到（型別連結）
void parseClientMessage;
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/backend/gateway.test.ts`
Expected: FAIL，找不到 `./gateway.js`。

- [ ] **Step 3: 建 backend/gateway.ts**

Create `src/backend/gateway.ts`:
```ts
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  parseClientMessage,
  type Command,
  type ResponseEnvelope,
  type RequestEnvelope,
} from "../core/protocol.js";

interface Pending {
  resolve: (r: ResponseEnvelope) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

/** WS server：管理 hands 連線（依 tenant）並做請求/回應配對。 */
export class Gateway {
  private wss: WebSocketServer | null = null;
  private readonly conns = new Map<string, WebSocket>(); // tenant -> socket
  private readonly pending = new Map<string, Pending>(); // request id -> waiter

  constructor(private readonly port: number) {}

  /** 啟動並回傳實際監聽的 port（傳 0 時由 OS 配）。 */
  listen(): Promise<number> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port }, () => {
        const addr = this.wss!.address();
        const actual = typeof addr === "object" && addr ? addr.port : this.port;
        resolve(actual);
      });
      this.wss.on("connection", (ws) => this.onConnection(ws));
    });
  }

  private onConnection(ws: WebSocket): void {
    let tenant: string | null = null;
    ws.on("message", (data) => {
      let msg;
      try {
        msg = parseClientMessage(data.toString());
      } catch {
        return; // 非法訊息：忽略，不讓單一連線打掛 server
      }
      if (msg.type === "hello") {
        tenant = msg.tenant;
        this.conns.set(tenant, ws);
        return;
      }
      // response
      const p = this.pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        p.resolve(msg);
      }
    });
    ws.on("close", () => {
      if (tenant && this.conns.get(tenant) === ws) this.conns.delete(tenant);
    });
  }

  /** 對某 tenant 的 hands 派一個指令，等回應或逾時。 */
  sendCommand(tenant: string, command: Command, timeoutMs = 30_000): Promise<ResponseEnvelope> {
    const ws = this.conns.get(tenant);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`no connection for tenant: ${tenant}`));
    }
    const id = randomUUID();
    const env: RequestEnvelope = { type: "request", id, command };
    return new Promise<ResponseEnvelope>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`command timeout for tenant ${tenant} (${command.action})`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify(env));
    });
  }

  /** 該 tenant 目前是否有 active 連線（排程派工前檢查）。 */
  isConnected(tenant: string): boolean {
    const ws = this.conns.get(tenant);
    return !!ws && ws.readyState === WebSocket.OPEN;
  }

  close(): Promise<void> {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("gateway closing"));
    }
    this.pending.clear();
    this.conns.clear();
    return new Promise((resolve) => {
      if (!this.wss) return resolve();
      this.wss.close(() => resolve());
    });
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/backend/gateway.test.ts`
Expected: PASS，4 個測試全過。

- [ ] **Step 5: Commit**

```bash
git add src/backend/gateway.ts src/backend/gateway.test.ts
git commit -m "feat: add backend WS gateway (tenant registry + request/response)"
```

---

### Task 8: 後端進入點（可手動啟動）

**Files:**
- Create: `src/backend/main.ts`
- Modify: `package.json`（加 `backend` script）

- [ ] **Step 1: 建 backend/main.ts**

Create `src/backend/main.ts`:
```ts
import { Gateway } from "./gateway.js";

const PORT = Number(process.env.WS_PORT ?? 18900);

async function main() {
  const gw = new Gateway(PORT);
  const port = await gw.listen();
  console.log(`✅ agent-mkt backend gateway listening on ws://127.0.0.1:${port}`);

  const shutdown = async () => {
    console.log("\n關閉 gateway…");
    await gw.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: 加 backend script**

修改 `package.json` 的 `"scripts"`，新增：
```json
    "backend": "node --env-file=.env --import tsx/esm src/backend/main.ts"
```

- [ ] **Step 3: 手動驗證可啟動**

Run: `npm run backend`
Expected: 印出 `✅ agent-mkt backend gateway listening on ws://127.0.0.1:18900`，Ctrl-C 可乾淨關閉。

- [ ] **Step 4: typecheck 全專案**

Run: `npm run typecheck`
Expected: 無錯誤。

- [ ] **Step 5: 跑全部測試**

Run: `npm test`
Expected: 全部 PASS（filter / throttle / protocol / adapters / gateway）。

- [ ] **Step 6: Commit**

```bash
git add src/backend/main.ts package.json
git commit -m "feat: add backend entrypoint with graceful shutdown"
```

---

## Self-Review

**Spec coverage（對照設計稿 §4/§7）：**
- §4 ① core（types/filter/throttle）→ Task 2/3/4 ✅；prompt/rules 不在 Plan 1（無 LLM 鏈路，留後續計畫）。
- §4 ② adapters → Task 6 ✅（Storage/SecretStore/ScoutAdapter/PublisherAdapter/LLMClient 介面就位；方法簽章隨後續計畫補）。
- §4 ③ backend gateway → Task 7 ✅；orchestrator/scheduler/kb/review-api 屬後續計畫。
- §7 通道（WS、correlation、gated 在連線）→ Task 7 `sendCommand`/`isConnected` ✅；「掛 content script」屬 Plan 2 的 hands。
- 協定契約 → Task 5 ✅（含 `element_not_found` 縫，呼應 §5 範式 A 觸發點）。

**Placeholder scan：** 無 TBD/TODO；每個 code step 均含完整程式碼與精確指令、預期輸出。

**Type consistency：** `RequestEnvelope`/`ResponseEnvelope`/`Hello`/`Command` 定義於 Task 5，Task 7 gateway 一致使用；`parseClientMessage` 命名一致；`Storage.get/set`、`SecretStore.getSecret` 在 Task 6 定義並於測試替身一致使用。

**Scope：** Plan 1 自成可測交付（core 函式庫 + WS gateway）。Extension hands、orchestrator、SQLite、審核台、scout/postReply 指令、LLM 鏈路屬 Plan 2+。

---

## 後續計畫預告（不在本檔）

- **Plan 2**：Extension hands 骨架（WXT）+ content script WS client + 端到端 hello（ping→pong 跨真實瀏覽器）。
- **Plan 3**：海巡(B) — content/scout + 本地 filter 迴圈 + budget + scout 指令。
- **Plan 4**：reply 寫稿 — orchestrator + LLMClient + prompt + kb 讀 + SQLite review_item。
- **Plan 5**：審核台 — side panel + review-api。
- **Plan 6**：發布(B) — content/actor postReply（合成事件 + 輸入後端縫）+ history/throttle，閉合 MVP。
