// PoC 用：不開 Electron，直接跑海巡 pipeline 驗證 Module B。
//
// 用法：npm run scout
import { runScoutPipeline } from "../src/workflow/pipeline.js";

console.log("🚀 agent-mkt scout 啟動");
console.log("   profile dir:", process.env.PW_PROFILE_DIR ?? ".playwright-profile");
console.log();

let exitCode = 0;
try {
  const stats = await runScoutPipeline({ maxPerKeyword: 5 });

  console.log("\n" + "=".repeat(60));
  console.log("海巡結果");
  console.log("=".repeat(60));
  console.log("session    :", stats.session_id);
  console.log("瀏覽貼文數  :", stats.posts_viewed);
  console.log("偵測訊號   :", stats.detection_signals.length ? stats.detection_signals.join(", ") : "無");
  console.log();

  if (stats.posts_viewed > 0) {
    console.log("✅ 草稿已進 data/queue.json");
    console.log("   啟動 Electron 審核台：npm run dev");
  } else {
    console.log("ℹ️  本次未抓到符合條件的 popular 文章（可能是 selector 需校正或帳號未登入）");
  }
} catch (err) {
  console.error("\n❌ 執行錯誤：");
  console.error(err);
  exitCode = 1;
}

process.exit(exitCode);
