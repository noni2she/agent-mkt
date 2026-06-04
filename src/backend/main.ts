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

  if (process.env.DEV_SCOUT) {
    const keyword = process.env.DEV_SCOUT;
    console.log(`[dev] DEV_SCOUT：10s 後對 tenant 'us' 下 scout("${keyword}")`);
    setTimeout(async () => {
      try {
        const r = await queue.enqueue("us", { action: "scout", keyword }, 60_000);
        const posts = Array.isArray(r.payload) ? r.payload : [];
        console.log(`[dev] scout 回傳 ${posts.length} 篇候選：`);
        for (const p of posts as Array<{ author_handle: string; likes: number; text: string }>) {
          console.log(`  - @${p.author_handle} 👍${p.likes} ${p.text.slice(0, 40).replace(/\n/g, " ")}…`);
        }
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
