import { CommandQueue } from "./commandQueue.js";
import { scoutAndReview } from "./coordinator.js";
import { startPoster } from "./poster.js";
import { createPollServer } from "./server.js";
import { scoutBudget } from "./scoutTuning.js";
import { getTenantConfig, type TenantConfig } from "./store.js";

const PORT = Number(process.env.HTTP_PORT ?? 18900);

/** 取某租戶的海巡 criteria。以 tenant_config 為基底，DEV_* env 可覆寫。 */
function criteriaFor(config: TenantConfig) {
  return {
    minLikes: process.env.DEV_MIN_LIKES ? Number(process.env.DEV_MIN_LIKES) : config.minLikes,
    excludeKeywords: process.env.DEV_EXCLUDE
      ? process.env.DEV_EXCLUDE.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : config.excludeKeywords,
    maxAgeHours: process.env.DEV_MAX_AGE_HOURS
      ? Number(process.env.DEV_MAX_AGE_HOURS)
      : config.maxAgeHours ?? undefined,
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
    const config = getTenantConfig("us");
    const keyword = process.env.DEV_SCOUT || config.keywords[0] || "";
    console.log(`[dev] DEV_SCOUT：10s 後對 tenant 'us' 下 scout("${keyword}")`);
    setTimeout(async () => {
      try {
        const criteria = criteriaFor(config);
        const budget = scoutBudget();
        const serpType = process.env.DEV_SERP === "recent" ? "recent" : config.serpType;
        const targetRelevant = process.env.DEV_TARGET_RELEVANT ? Number(process.env.DEV_TARGET_RELEVANT) : config.targetRelevant;
        console.log(`[dev] scout serp=${serpType} minLikes=${criteria.minLikes} maxAgeHours=${criteria.maxAgeHours ?? "∞"} 目標相關=${targetRelevant}`);
        await scoutAndReview(queue, "us", { keyword, serpType, criteria, budget, targetRelevant });
      } catch (e) {
        console.log("[dev] scout:", (e as Error).message);
      }
    }, 10_000);
  }

  startPoster(queue);
});

const shutdown = () => {
  console.log("\n關閉 server…");
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
