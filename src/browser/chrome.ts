// Chrome 生命週期與 chrome-devtools-mcp 分離（對齊 agent-bugfix 行為）：
//  - Chrome 用 --browserUrl 連入，MCP client close() 後 Chrome 繼續存活
//  - 下次 scout:mcp 偵測到 Chrome 已在跑 → 直接連，在現有視窗開新 tab
//  - 若 Chrome 不在（第一次或被關掉）→ 自動 spawn，不需手動操作
//  - 日常 Chrome 無 --remote-debugging-port，不在 port 19222，完全不受影響
import { spawn } from "node:child_process";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const DEBUG_PORT = Number(process.env.CDP_DEBUG_PORT ?? 19222);
const BROWSER_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const CDP_PROFILE_DIR = join(process.cwd(), ".cdp-profile");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export interface McpHandle {
  client: Client;
  close: () => Promise<void>;
}

async function isChromeReady(): Promise<boolean> {
  try {
    const res = await fetch(`${BROWSER_URL}/json/version`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Chrome 在跑但視窗被關時，用 osascript 補開一個 */
async function ensureWindowOpen(): Promise<void> {
  try {
    const res = await fetch(`${BROWSER_URL}/json/list`, { signal: AbortSignal.timeout(1000) });
    const targets = (await res.json()) as Array<{ type: string }>;
    if (!targets.some((t) => t.type === "page")) {
      spawn("osascript", ["-e", `tell application "Google Chrome" to make new window`], {
        stdio: "ignore",
      });
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch { /* 略過 */ }
}

async function ensureChromeRunning(): Promise<void> {
  if (await isChromeReady()) {
    console.log(`  ℹ️  Chrome 已在 port ${DEBUG_PORT}，直接連線`);
    await ensureWindowOpen();
    return;
  }

  console.log(`  🌐 啟動 Chrome（.cdp-profile + port ${DEBUG_PORT}）…`);
  const child = spawn(
    CHROME,
    [
      `--user-data-dir=${CDP_PROFILE_DIR}`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--remote-allow-origins=*",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { detached: true, stdio: "ignore" },
  );
  child.unref();

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isChromeReady()) {
      console.log("  ✅ Chrome 已就緒");
      return;
    }
  }
  throw new Error(`Chrome 啟動逾時（port ${DEBUG_PORT} 無回應）`);
}

export async function connect(): Promise<McpHandle> {
  await ensureChromeRunning();

  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y",
      "chrome-devtools-mcp@latest",
      `--browserUrl=${BROWSER_URL}`,
      "--no-usage-statistics",
      "--no-category-performance",
      "--no-category-network",
      "--no-category-emulation",
    ],
  });

  const client = new Client(
    { name: "agent-mkt-scout", version: "0.1.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  return {
    client,
    close: async () => {
      await client.close().catch(() => {});
    },
  };
}
