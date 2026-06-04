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

  chrome.alarms.create("poll", { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === "poll") void pollOnce(); });

  void pollOnce();
  setInterval(() => void pollOnce(), 5_000);

  console.log("[hands] background 啟動，開始 polling", BASE);
});
