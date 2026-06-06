import { CommandQueue } from "./commandQueue.js";
import { scoutAndReview } from "./coordinator.js";
import { createPollServer } from "./server.js";

const PORT = Number(process.env.HTTP_PORT ?? 18900);

/** 取某租戶的海巡 criteria。現在用 env/預設；Plan 4 改為從 tenant_config store 讀。 */
function criteriaFor(_tenant: string) {
  return {
    minLikes: Number(process.env.DEV_MIN_LIKES ?? 100),
    excludeKeywords: (process.env.DEV_EXCLUDE ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    maxAgeHours: process.env.DEV_MAX_AGE_HOURS ? Number(process.env.DEV_MAX_AGE_HOURS) : undefined,
  };
}

/** 取某租戶的海巡 budget（先到先停上限）。現在用 env/預設；Plan 4 改從 tenant_config store 讀。 */
function budgetFor(_tenant: string) {
  return {
    targetCandidates: Number(process.env.DEV_TARGET ?? 10),
    maxScrolls: Number(process.env.DEV_MAX_SCROLLS ?? 30),
    maxScanned: Number(process.env.DEV_MAX_SCANNED ?? 60),
  };
}

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

  if (process.env.DEV_SCOUT) {
    const keyword = process.env.DEV_SCOUT;
    console.log(`[dev] DEV_SCOUT：10s 後對 tenant 'us' 下 scout("${keyword}")`);
    setTimeout(async () => {
      try {
        const criteria = criteriaFor("us");
        const budget = budgetFor("us");
        const serpType = process.env.DEV_SERP === "recent" ? "recent" : "default";
        const targetRelevant = Number(process.env.DEV_TARGET_RELEVANT ?? 3);
        console.log(`[dev] scout serp=${serpType} minLikes=${criteria.minLikes} maxAgeHours=${criteria.maxAgeHours ?? "∞"} 目標相關=${targetRelevant}`);
        await scoutAndReview(queue, "us", { keyword, serpType, criteria, budget, targetRelevant });
      } catch (e) {
        console.log("[dev] scout:", (e as Error).message);
      }
    }, 10_000);
  }
});

const shutdown = () => {
  console.log("\n關閉 server…");
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
