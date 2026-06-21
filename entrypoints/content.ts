import type { ScoutCandidate, ScoutBudget, ScoutCriteria } from "../src/core/protocol";
import { parseCount } from "../src/core/filter";

// content script 注入 Threads；收 SW 的 scout 訊息 → 捲動抓取 → 回傳候選。
// 只讀 DOM + 與 SW 訊息往來，不直接連後端（避開頁面 CSP）。
export default defineContentScript({
  matches: ["https://www.threads.com/*", "https://www.threads.net/*"],
  async main() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "scout") {
        scout(
          msg.keyword as string,
          msg.criteria as Partial<ScoutCriteria> | undefined,
          msg.budget as Partial<ScoutBudget> | undefined,
          (msg.excludeIds as string[] | undefined) ?? [],
        )
          .then((r) => sendResponse({ ok: true, candidates: r.candidates, health: r.health }))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true; // async sendResponse
      }
      if (msg?.type === "scout_stop") {
        currentScoutAbort?.abort();
        sendResponse({ ok: true });
        return true;
      }
      if (msg?.type === "post_reply") {
        postReply(msg.postUrl as string, msg.draft as string, msg.dryRun === true, msg.reviewItemId as string | undefined)
          .then((r) => sendResponse(r))
          .catch((e) => sendResponse({ ok: false, error: String(e) }));
        return true;
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

/** Threads UI 按鈕文字（非內文），抓取時排除。 */
const JUNK_LABELS = new Set(["Translate", "翻譯", "查看翻譯", "See translation"]);
let currentScoutAbort: AbortController | null = null;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
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
  // 讀文字但移除其中的按鈕：Translate、讚/留言/轉發等計數都是 role="button" 的 span，會混進 textContent
  const cleanText = (el: HTMLElement): string => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[role="button"]').forEach((b) => b.remove());
    return (clone.textContent ?? "").trim();
  };
  const blocks: string[] = [];
  card.querySelectorAll<HTMLElement>('[dir="auto"]').forEach((el) => {
    if (isAuthorOrTime(el) || !afterTime(el)) return; // 排除作者/時間，只取時間之後
    if (el.closest('[role="button"]')) return; // 本身在按鈕內 → 跳過
    const t = cleanText(el);
    if (!t || isCount(t) || JUNK_LABELS.has(t)) return;
    // 只取最外層：若祖先也是「合格文字 dir=auto」，代表本元素是巢狀子層 → 跳過避免重複
    let p = el.parentElement;
    while (p && p !== card) {
      if (p.matches('[dir="auto"]') && !isAuthorOrTime(p) && !p.closest('[role="button"]')) {
        const pt = cleanText(p);
        if (pt && !isCount(pt)) return;
      }
      p = p.parentElement;
    }
    blocks.push(t);
  });
  return blocks.join("\n").trim();
}

async function scout(
  keyword: string,
  criteria?: Partial<ScoutCriteria>,
  b?: Partial<ScoutBudget>,
  excludeIds: string[] = [],
): Promise<{ candidates: ScoutCandidate[]; health: { scanned: number; withText: number; withLikeBtn: number } }> {
  currentScoutAbort?.abort();
  const abortController = new AbortController();
  currentScoutAbort = abortController;
  const { signal } = abortController;
  const targetCandidates = b?.targetCandidates ?? 10;
  const maxScrolls = b?.maxScrolls ?? 30;
  const maxScanned = b?.maxScanned ?? 60;
  const minLikes = criteria?.minLikes ?? 100;
  const excludeKeywords = criteria?.excludeKeywords ?? [];
  const maxAgeHours = criteria?.maxAgeHours;

  const out: ScoutCandidate[] = [];
  const seen = new Set<string>(excludeIds);
  let scrolls = 0;
  let scanned = 0;
  let withText = 0;
  let withLikeBtn = 0;

  while (!signal.aborted && out.length < targetCandidates && scrolls < maxScrolls && scanned < maxScanned) {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(SEL.post));
    for (const card of cards) {
      if (signal.aborted || out.length >= targetCandidates || scanned >= maxScanned) break;
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
    if (signal.aborted) break;
    window.scrollBy(0, 700 + Math.floor(Math.random() * 400));
    await sleep(jitter(1500), signal);
    scrolls += 1;
  }
  const stale = scanned > 0 && (withText === 0 || withLikeBtn === 0);
  console.log(`[scout] 套用條件 minLikes=${minLikes} maxAgeHours=${maxAgeHours ?? "∞"} exclude=[${excludeKeywords.join(", ")}]`);
  console.log(`[scout] keyword="${keyword}" scanned=${scanned} scrolls=${scrolls} candidates=${out.length} withText=${withText} withLikeBtn=${withLikeBtn}`);
  if (signal.aborted) console.log("[scout] 已中止");
  if (stale) console.warn(`[scout] ⚠️ 選擇器疑似失效：掃了 ${scanned} 張卡但 withText=${withText} withLikeBtn=${withLikeBtn}`);
  if (currentScoutAbort === abortController) currentScoutAbort = null;
  return { candidates: out, health: { scanned, withText, withLikeBtn } };
}

/** 在當前已登入的 Threads 分頁開啟貼文 → 回覆草稿 → 提交。dryRun 時跑流程但不真的提交。 */
async function postReply(postUrl: string, draft: string, dryRun: boolean, reviewItemId?: string): Promise<{ ok: boolean; error?: string }> {
  if (!draft || !draft.trim()) return { ok: false, error: "empty draft" };
  try {
    if (location.href !== postUrl) {
      window.location.assign(postUrl);
      await waitFor(() => document.querySelector('div[data-pressable-container="true"]') != null, 8000);
    }
    const replyTrigger = findReplyTrigger();
    if (!replyTrigger) return { ok: false, error: "reply trigger not found" };
    replyTrigger.click();
    const editor = await waitForEl<HTMLElement>('div[contenteditable="true"][role="textbox"]', 6000);
    if (!editor) return { ok: false, error: "reply editor not found" };
    editor.focus();
    document.execCommand("insertText", false, draft);
    if (dryRun) {
      console.log("[poster] dry-run：流程完成但不送出", { postUrl, draftPreview: draft.slice(0, 40) });
      if (reviewItemId) startPreviewAutoSentPoller(reviewItemId, postUrl, editor);
      return { ok: true };
    }
    const submitBtn = findSubmitButton();
    if (!submitBtn) return { ok: false, error: "submit button not found" };
    submitBtn.click();
    const success = await waitFor(() => {
      const e = document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement | null;
      return !e || (e.textContent ?? "").trim() === "";
    }, 8000);
    if (!success) return { ok: false, error: "submit timeout" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function startPreviewAutoSentPoller(reviewItemId: string, postUrl: string, initialEditor: HTMLElement): void {
  const startedAt = Date.now();
  let leftPostAt: number | null = null;
  const timer = window.setInterval(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed > 30 * 60_000) {
      window.clearInterval(timer);
      return;
    }

    const onPost = location.href === postUrl;
    if (!onPost) {
      leftPostAt ??= Date.now();
      if (Date.now() - leftPostAt >= 5000) window.clearInterval(timer);
      return;
    }
    leftPostAt = null;

    if (elapsed < 5000) return;
    const editor = (document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement | null) ?? initialEditor;
    const empty = !editor.isConnected || (editor.textContent ?? "").trim() === "";
    if (!empty) return;

    window.clearInterval(timer);
    chrome.runtime.sendMessage({ type: "preview_auto_sent", id: reviewItemId }).catch(() => {});
  }, 1500);
}

function findReplyTrigger(): HTMLElement | null {
  const selectors = [
    'svg[aria-label*="reply" i]',
    'svg[aria-label*="留言"]',
    'svg[aria-label*="回覆"]',
    'div[role="button"][aria-label*="reply" i]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return (el.closest('[role="button"]') as HTMLElement) ?? (el as HTMLElement);
  }
  return null;
}

function findSubmitButton(): HTMLElement | null {
  const selectors = [
    'div[role="button"][aria-label*="post" i]',
    'div[role="button"][aria-label*="送出"]',
    'div[role="button"][aria-label*="發布"]',
    'button[type="submit"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el as HTMLElement;
  }
  return null;
}

async function waitFor(pred: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function waitForEl<T extends Element>(selector: string, timeoutMs: number): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector) as T | null;
    if (el) return el;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}
