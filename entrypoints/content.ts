import type { ScoutCandidate, ScoutBudget } from "../src/core/protocol";
import { parseCount } from "../src/core/filter";

// content script 注入 Threads；收 SW 的 scout 訊息 → 捲動抓取 → 回傳候選。
// 只讀 DOM + 與 SW 訊息往來，不直接連後端（避開頁面 CSP）。
export default defineContentScript({
  matches: ["https://www.threads.com/*", "https://www.threads.net/*"],
  async main() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "scout") {
        scout(msg.keyword as string, msg.budget as Partial<ScoutBudget> | undefined)
          .then((candidates) => sendResponse({ ok: true, candidates }))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true; // async sendResponse
      }
      return false;
    });
    console.log("[scout] content script ready");
  },
});

const SEL = {
  post: 'div[data-pressable-container="true"]',
  postText: '[data-testid="post-text"], div[dir="auto"]',
  likeBtn: 'svg[aria-label*="讚"], svg[aria-label*="ike"]',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (mean: number) => Math.max(300, Math.round(mean * (0.6 + Math.random() * 0.8)));

async function scout(keyword: string, b?: Partial<ScoutBudget>): Promise<ScoutCandidate[]> {
  const targetCandidates = b?.targetCandidates ?? 10;
  const maxScrolls = b?.maxScrolls ?? 30;
  const maxScanned = b?.maxScanned ?? 60;

  if (!location.href.includes("/search")) {
    location.href = `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`;
    await sleep(3000);
    return [];
  }

  const out: ScoutCandidate[] = [];
  const seen = new Set<string>();
  let scrolls = 0;
  let scanned = 0;

  while (out.length < targetCandidates && scrolls < maxScrolls && scanned < maxScanned) {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(SEL.post));
    for (const card of cards) {
      if (out.length >= targetCandidates || scanned >= maxScanned) break;
      const link = card.querySelector<HTMLAnchorElement>('a[href*="/post/"]');
      const href = link?.getAttribute("href") ?? "";
      const id = href.split("/post/")[1]?.split(/[?/]/)[0] ?? "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      scanned += 1;

      const text = (card.querySelector(SEL.postText)?.textContent ?? "").trim();
      if (!text) continue;
      const aria = card.querySelector(SEL.likeBtn)?.getAttribute("aria-label") ?? "";
      const likes = parseCount(aria);
      const author = (card.querySelector('a[href^="/@"]')?.textContent ?? "unknown").replace(/^@/, "").trim();

      if (likes < 100) continue;

      out.push({
        id,
        url: href.startsWith("http") ? href : `https://www.threads.com${href}`,
        author_handle: author,
        text,
        likes,
        replies: 0,
        popular_reason: `👍${likes}`,
      });
    }
    window.scrollBy(0, 700 + Math.floor(Math.random() * 400));
    await sleep(jitter(1500));
    scrolls += 1;
  }
  console.log(`[scout] keyword="${keyword}" scanned=${scanned} scrolls=${scrolls} candidates=${out.length}`);
  return out;
}
