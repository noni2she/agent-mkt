// PoC 用：chrome-devtools-mcp 驅動的 AI 海巡（階段一，只海巡）。
//
// 用法：npm run scout:mcp
import { runMcpScout } from "../src/skills/scout/workflow.js";

// chrome-devtools-mcp 要求 Node ≥ 20.19
const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  console.error(`❌ 需要 Node ≥ 20.19，目前 ${process.versions.node}`);
  process.exit(1);
}

console.log("🚀 agent-mkt scout:mcp 啟動（chrome-devtools-mcp AI 海巡）");
console.log("   profile dir: .cdp-profile（與日常 Chrome / Playwright 完全隔離）");
console.log();

let exitCode = 0;
try {
  const stats = await runMcpScout();

  console.log("\n" + "=".repeat(60));
  console.log("MCP 海巡結果");
  console.log("=".repeat(60));
  console.log("session    :", stats.session_id);
  console.log("抽取貼文數  :", stats.posts_viewed);
  console.log("偵測訊號   :", stats.detection_signals.length ? stats.detection_signals.join(", ") : "無");
  console.log();

  if (stats.posts_viewed > 0) {
    console.log("✅ 通過 popular 的貼文已寫入 data/queue.json（draft 留空）");
    console.log("   開 Electron 審核台檢視：npm run dev");
  } else {
    console.log("ℹ️  本次未抽到貼文（可能未登入 / 搜尋無結果 / agent 需調整）");
  }
} catch (err) {
  console.error("\n❌ 執行錯誤：");
  console.error(err);
  exitCode = 1;
}

process.exit(exitCode);
