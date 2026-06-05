import type { ScoutCandidate, ScoutBudget, ScoutCriteria } from "../src/core/protocol";
import { parseCount } from "../src/core/filter";

// content script 注入 Threads；收 SW 的 scout 訊息 → 捲動抓取 → 回傳候選。
// 只讀 DOM + 與 SW 訊息往來，不直接連後端（避開頁面 CSP）。
export default defineContentScript({
  matches: ["https://www.threads.com/*", "https://www.threads.net/*"],
  async main() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "scout") {
        scout(msg.keyword as string, msg.criteria as Partial<ScoutCriteria> | undefined, msg.budget as Partial<ScoutBudget> | undefined)
          .then((r) => sendResponse({ ok: true, candidates: r.candidates, health: r.health }))
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

/** 從動作鈕（Like/Reply…）文字抽數字：「Like10」→10、「讚1.2萬」→12000。aria-label 跨語系皆試。 */
function countFromButton(card: HTMLElement, labels: string[]): number {
  for (const label of labels) {
    const svg =
      card.querySelector(`svg[aria-label="${label}"]`) ?? card.querySelector(`svg[aria-label*="${label}"]`);
    const btn = svg?.closest('div[role="button"], a, button');
    const m = (btn?.textContent ?? "").match(/[\d.,]+\s*[萬kKwW]?/);
    if (m) return parseCount(m[0]);
  }
  return 0;
}

/**
 * 內文：Threads 卡片順序為 作者 → 分類 → <time> → 內文段落 → 計數。
 * 故只取「<time> 之後、非作者/時間/純數字、最外層」的 dir="auto" 文字塊並串接（支援多段落）。
 */
function extractPostText(card: HTMLElement): string {
  const timeEl = card.querySelector("time");
  const isAuthorOrTime = (el: Element) => !!el.closest("time") || !!el.closest('a[href^="/@"]');
  const isCount = (t: string) => /^[\d.,]+\s*[萬kKwW]?$/.test(t);
  const afterTime = (el: Element) =>
    !timeEl || !!(timeEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  const blocks: string[] = [];
  card.querySelectorAll<HTMLElement>('[dir="auto"]').forEach((el) => {
    if (isAuthorOrTime(el) || !afterTime(el)) return; // 排除作者/時間，且只取時間之後（過濾分類標籤）
    const t = (el.textContent ?? "").trim();
    if (!t || isCount(t)) return;
    // 只取最外層：若祖先也是「合格文字 dir=auto」，代表本元素是巢狀子層 → 跳過避免重複
    let p = el.parentElement;
    while (p && p !== card) {
      if (p.matches('[dir="auto"]') && !isAuthorOrTime(p)) {
        const pt = (p.textContent ?? "").trim();
        if (pt && !isCount(pt)) return;
      }
      p = p.parentElement;
    }
    blocks.push(t);
  });
  return blocks.join("\n");
}

async function scout(
  keyword: string,
  criteria?: Partial<ScoutCriteria>,
  b?: Partial<ScoutBudget>,
): Promise<{ candidates: ScoutCandidate[]; health: { scanned: number; withText: number; withLikeBtn: number } }> {
  const targetCandidates = b?.targetCandidates ?? 10;
  const maxScrolls = b?.maxScrolls ?? 30;
  const maxScanned = b?.maxScanned ?? 60;
  const minLikes = criteria?.minLikes ?? 100;
  const excludeKeywords = criteria?.excludeKeywords ?? [];
  const maxAgeHours = criteria?.maxAgeHours;

  const out: ScoutCandidate[] = [];
  const seen = new Set<string>();
  let scrolls = 0;
  let scanned = 0;
  let withText = 0;
  let withLikeBtn = 0;

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

      const text = extractPostText(card);
      const likeBtnFound = !!card.querySelector('svg[aria-label="Like"], svg[aria-label*="讚"]');
      if (text) withText += 1;
      if (likeBtnFound) withLikeBtn += 1;
      if (!text) continue;
      const likes = countFromButton(card, ["Like", "讚"]);
      const replies = countFromButton(card, ["Reply", "回覆", "留言"]);
      const author = (card.querySelector('a[href^="/@"]')?.textContent ?? "unknown").replace(/^@/, "").trim();

      const datetime = card.querySelector("time")?.getAttribute("datetime") ?? "";
      const ageHours = datetime ? (Date.now() - new Date(datetime).getTime()) / 3_600_000 : Infinity;

      if (likes < minLikes) continue;
      if (excludeKeywords.some((k) => text.includes(k))) continue;
      if (maxAgeHours != null && ageHours > maxAgeHours) continue;

      out.push({
        id,
        url: href.startsWith("http") ? href : `https://www.threads.com${href}`,
        author_handle: author,
        text,
        likes,
        replies,
        posted_at: datetime || new Date().toISOString(),
        popular_reason: `👍${likes} ${isFinite(ageHours) ? Math.round(ageHours) + "h" : ""}`.trimEnd(),
      });
    }
    window.scrollBy(0, 700 + Math.floor(Math.random() * 400));
    await sleep(jitter(1500));
    scrolls += 1;
  }
  const stale = scanned > 0 && (withText === 0 || withLikeBtn === 0);
  console.log(`[scout] 套用條件 minLikes=${minLikes} maxAgeHours=${maxAgeHours ?? "∞"} exclude=[${excludeKeywords.join(", ")}]`);
  console.log(`[scout] keyword="${keyword}" scanned=${scanned} scrolls=${scrolls} candidates=${out.length} withText=${withText} withLikeBtn=${withLikeBtn}`);
  if (stale) console.warn(`[scout] ⚠️ 選擇器疑似失效：掃了 ${scanned} 張卡但 withText=${withText} withLikeBtn=${withLikeBtn}`);
  return { candidates: out, health: { scanned, withText, withLikeBtn } };
}
