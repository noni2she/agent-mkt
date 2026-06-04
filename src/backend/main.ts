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
