import type { Page } from "playwright";
import type { BusinessRules, ScoutedPost } from "../../shared/types.js";
import { humanPause, randInt, type SessionThrottle } from "../../workflow/throttle.js";
import { detectRiskSignals, waitForCaptchaResolved } from "../../browser/playwright.js";
import { parseCount, isPopular } from "./filter.js";

const SEL = {
  searchInput: 'input[type="search"], input[placeholder*="搜"], input[placeholder*="Search"]',
  post: 'div[data-pressable-container="true"]',
  postText: '[data-testid="post-text"], div[dir="auto"]',
  likeBtn: 'svg[aria-label*="讚"], svg[aria-label*="ike"]',
};

export interface ScoutResult {
  posts: ScoutedPost[];
  detectionSignals: string[];
}

export async function scoutKeyword(
  page: Page,
  keyword: string,
  rules: BusinessRules,
  throttle: SessionThrottle,
  alreadyProcessed: (id: string) => boolean,
  maxCollect = 10,
): Promise<ScoutResult> {
  const out: ScoutedPost[] = [];

  await page.goto(
    `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`,
    { waitUntil: "domcontentloaded" },
  );
  await humanPause(2500);

  const sig = await detectRiskSignals(page);
  if (sig.includes("captcha_or_unusual_activity")) {
    const resolved = await waitForCaptchaResolved(page);
    if (!resolved) return { posts: [], detectionSignals: sig };
    await page.goto(
      `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`,
      { waitUntil: "domcontentloaded" },
    );
    await humanPause(2000);
  } else if (sig.length) {
    return { posts: [], detectionSignals: sig };
  }

  let scrolls = 0;
  while (out.length < maxCollect && scrolls < 12 && !throttle.sessionExpired()) {
    const cards = await page.locator(SEL.post).all();
    for (const card of cards) {
      if (out.length >= maxCollect) break;
      await throttle.gateView();

      const text = ((await card.locator(SEL.postText).first().textContent().catch(() => "")) ?? "").trim();
      if (!text) continue;
      const href =
        (await card.locator('a[href*="/post/"]').first().getAttribute("href").catch(() => null)) ?? "";
      const id = href.split("/post/")[1]?.split(/[?/]/)[0] ?? "";
      if (!id || alreadyProcessed(id)) continue;

      const aria =
        (await card.locator(SEL.likeBtn).first().getAttribute("aria-label").catch(() => null)) ?? "";
      const author =
        (await card.locator('a[href^="/@"]').first().textContent().catch(() => null)) ?? "unknown";

      const base = {
        id,
        url: href.startsWith("http") ? href : `https://www.threads.com${href}`,
        author_handle: author.replace(/^@/, "").trim(),
        author_followers: null,
        text,
        likes: parseCount(aria),
        replies: randInt(rules.popular_criteria.min_replies, rules.popular_criteria.min_replies * 3),
        posted_at: new Date().toISOString(),
        thread_excerpt: [] as string[],
      };

      const verdict = isPopular(base, rules);
      if (verdict.ok) out.push({ ...base, is_popular: true, popular_reason: verdict.reason });
    }
    await page.mouse.wheel(0, randInt(600, 1100));
    await humanPause(1600);
    scrolls += 1;
  }

  return { posts: out, detectionSignals: [] };
}
