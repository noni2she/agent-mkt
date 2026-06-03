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
