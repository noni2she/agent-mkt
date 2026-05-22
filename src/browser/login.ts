// 確定性登入偵測（非 LLM 驅動）。
//
// 沿用 Playwright 路線 browser.ts:ensureLoggedIn 已調校好的 UX：
//  - 導向 threads.com 僅一次
//  - 未登入 → 印提示 → 無限等待，每 3 秒靜默重檢，期間不發其他指令
//  - 用 evaluate_script 在頁面內判斷，不依賴 LLM、不改變頁面狀態
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

/** 從 callTool 回傳內容取出純文字 */
function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const res = await client.callTool({ name, arguments: args });
  return textOf(res);
}

/**
 * 判斷目前頁面是否已登入。
 * 與 Playwright 路線一致：登入後 nav 才有 a[href="/notifications"]。
 * 用 evaluate_script 在頁面內查詢，回傳 "yes" / "no"。
 */
async function isLoggedIn(client: Client): Promise<boolean> {
  const out = await callTool(client, "evaluate_script", {
    function: `() => {
      try {
        const href = location.href;
        // 明確在登入頁 → 未登入
        if (/\\/login|\\/signup|accounts\\/login/i.test(href)) return "no";
        const body = document.body?.textContent ?? "";
        // 「為你推薦」「追蹤中」tab 只有登入後的首頁才有
        if (/為你推薦|追蹤中|For you|Following/i.test(body)) return "yes";
        // compose box placeholder 只有登入後才出現
        if (/新鮮事|What.s new/i.test(body)) return "yes";
        return "no";
      } catch (e) { return "no"; }
    }`,
  });
  return /(^|[^a-z])yes([^a-z]|$)/i.test(out);
}

/**
 * 確保已登入 Threads。未登入則無限等待使用者手動登入。
 * 登入成功回傳 true。
 */
export async function ensureLoggedIn(client: Client): Promise<boolean> {
  await callTool(client, "navigate_page", {
    type: "url",
    url: "https://www.threads.com/",
  });
  // 給頁面渲染時間
  await new Promise((r) => setTimeout(r, 4000));

  if (await isLoggedIn(client)) return true;

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  尚未登入 Threads");
  console.log("請在 chrome-devtools-mcp 開啟的瀏覽器視窗中手動登入。");
  console.log("登入後程式自動偵測並繼續（程式不會再動頁面，請放心操作）。");
  console.log("=".repeat(60) + "\n");

  let dots = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, 3000));
    if (await isLoggedIn(client)) {
      console.log("\n✅ 登入成功，開始 AI 海巡…\n");
      return true;
    }
    process.stdout.write(".");
    if (++dots % 20 === 0) process.stdout.write("\n");
  }
}
