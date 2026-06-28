// SW 用 chrome.alarms 定時 + 啟動/處理後立即 poll 後端，執行 ping、回 pong。
// 注意：WXT 預設 auto-import defineBackground；若版本需顯式 import，
// 加 `import { defineBackground } from "wxt/utils/define-background";`。
export default defineBackground(() => {
  const TENANT = "us";
  const BASE = "http://127.0.0.1:18900";

  type PolledCommand = {
    id: string;
    command: {
      action: string;
      keyword?: string;
      serpType?: string;
      criteria?: unknown;
      budget?: unknown;
      excludeIds?: unknown;
      postUrl?: string;
      draft?: string;
      dryRun?: boolean;
      reviewItemId?: string;
      expectedHandle?: string;
    };
  };

  async function pollOnce() {
    let cmds: PolledCommand[];
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
      } else if (command.action === "scout_stop") {
        await handleScoutStop(id);
      } else if (command.action === "scout") {
        await handleScout(id, command as { keyword: string; serpType?: string; criteria?: unknown; budget?: unknown; excludeIds?: unknown; expectedHandle?: string });
      } else if (command.action === "post_reply") {
        await handlePostReply(id, command as { postUrl: string; draft: string; dryRun?: boolean; reviewItemId?: string; expectedHandle?: string });
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

  async function handleScout(id: string, command: { keyword: string; serpType?: string; criteria?: unknown; budget?: unknown; excludeIds?: unknown; expectedHandle?: string }) {
    const tabs = await chrome.tabs.query({
      url: ["https://www.threads.com/*", "https://www.threads.net/*"],
    });
    const tab = tabs[0];
    if (!tab?.id) {
      console.log("[hands] scout: 沒有開著的 Threads 分頁");
      await postResult({ type: "response", id, status: "element_not_found", error: "no threads tab" });
      return;
    }
    const tabId = tab.id;
    const serp = command.serpType === "recent" ? "serp_type=tags&filter=recent" : "serp_type=default";
    const encodedKeyword = encodeURIComponent(command.keyword);
    const searchUrl = `https://www.threads.com/search?q=${encodedKeyword}&${serp}`;
    try {
      const currentTab = await chrome.tabs.get(tabId);
      const currentUrl = currentTab.url ?? "";
      const currentQuery = currentUrl.match(/[?&]q=([^&]*)/)?.[1];
      if (currentUrl.startsWith("https://www.threads.com/search?q=") && currentQuery === encodedKeyword) {
        console.log("[hands] scout: 已在同關鍵字搜尋頁，跳過導頁", currentUrl);
      } else {
        console.log("[hands] scout: 導頁到搜尋頁…", searchUrl);
        await navigateAndWait(tabId, searchUrl);
      }
      const res = await chrome.tabs.sendMessage(tabId, {
        type: "scout",
        keyword: command.keyword,
        criteria: command.criteria,
        budget: command.budget,
        excludeIds: command.excludeIds,
        expectedHandle: command.expectedHandle,
      });
      if (res?.ok) {
        const h = res.health as { scanned: number; withText: number; withLikeBtn: number } | undefined;
        const stale = !!h && h.scanned > 0 && (h.withText === 0 || h.withLikeBtn === 0);
        if (stale) {
          console.warn("[hands] ⚠️ 選擇器疑似失效，非真的沒貼文", h);
          await postResult({
            type: "response",
            id,
            status: "element_not_found",
            error: `selectors stale: scanned=${h!.scanned} withText=${h!.withText} withLikeBtn=${h!.withLikeBtn}`,
            payload: res.candidates,
          });
        } else {
          console.log(`[hands] scout 完成，候選 ${res.candidates.length} 篇`);
          await postResult({ type: "response", id, status: "ok", payload: res.candidates });
        }
      } else {
        const error = res?.error ?? "scout failed";
        await postResult({
          type: "response",
          id,
          status: typeof error === "string" && error.startsWith("mismatch:") ? "account_mismatch" : "fail",
          error,
        });
      }
    } catch (e) {
      await postResult({ type: "response", id, status: "fail", error: String(e) });
    }
  }

  async function handleScoutStop(id: string) {
    const tabs = await chrome.tabs.query({
      url: ["https://www.threads.com/*", "https://www.threads.net/*"],
    });
    const tabId = tabs[0]?.id;
    if (tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: "scout_stop" });
        console.log("[hands] scout: 已送出中止訊號");
      } catch (e) {
        console.log("[hands] scout: 中止訊號送出失敗", (e as Error).message);
      }
    }
    await postResult({ type: "response", id, status: "ok", payload: "stopped" });
  }

  async function handlePostReply(id: string, command: { postUrl: string; draft: string; dryRun?: boolean; reviewItemId?: string; expectedHandle?: string }) {
    const tabs = await chrome.tabs.query({
      url: ["https://www.threads.com/*", "https://www.threads.net/*"],
    });
    const tab = tabs[0];
    if (!tab?.id) {
      console.log("[hands] post_reply: 沒有開著的 Threads 分頁");
      await postResult({ type: "response", id, status: "element_not_found", error: "no threads tab" });
      return;
    }
    try {
      const res = await chrome.tabs.sendMessage(tab.id, {
        type: "post_reply",
        postUrl: command.postUrl,
        draft: command.draft,
        dryRun: command.dryRun,
        reviewItemId: command.reviewItemId,
        expectedHandle: command.expectedHandle,
      });
      if (res?.ok) {
        await postResult({ type: "response", id, status: "ok" });
      } else {
        const error = res?.error ?? "post_reply failed";
        await postResult({
          type: "response",
          id,
          status: typeof error === "string" && error.startsWith("mismatch:") ? "account_mismatch" : "fail",
          error,
        });
      }
    } catch (e) {
      await postResult({ type: "response", id, status: "fail", error: String(e) });
    }
  }

  /** 導頁並等該分頁 load 完成，再多等一下讓 content script 注入 + Threads 動態內容載入。 */
  function navigateAndWait(tabId: number, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("navigate timeout"));
      }, 20_000);
      function listener(updatedTabId: number, info: chrome.tabs.TabChangeInfo) {
        if (updatedTabId === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          setTimeout(resolve, 1500);
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.update(tabId, { url }).catch((e: unknown) => {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        reject(e instanceof Error ? e : new Error(String(e)));
      });
    });
  }

  chrome.alarms.create("poll", { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === "poll") void pollOnce(); });

  void pollOnce();
  setInterval(() => void pollOnce(), 5_000);

  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "preview_auto_sent") return false;
    void resolvePreviewSent(msg.id as string)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => {
        console.warn("[hands] preview auto resolve 失敗", e instanceof Error ? e.message : String(e));
        sendResponse({ ok: false });
      });
    return true;
  });

  async function resolvePreviewSent(id: string): Promise<void> {
    if (!id) return;
    const r = await fetch(`${BASE}/api/v1/preview/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action: "sent" }),
    });
    if (!r.ok) throw new Error(`preview resolve failed: ${r.status}`);
  }

  console.log("[hands] background 啟動，開始 polling", BASE);
});
