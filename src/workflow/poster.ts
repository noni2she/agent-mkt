import type { Page } from "playwright";
import type { BusinessRules, ReviewItem } from "../shared/types.js";
import { humanPause } from "./throttle.js";
import { detectRiskSignals } from "../browser/playwright.js";

export class SafetyError extends Error {}

export async function sendReply(
  page: Page,
  item: ReviewItem,
  rules: BusinessRules,
): Promise<{ ok: boolean; signals: string[] }> {
  if (!rules.safety.require_human_approval_before_send)
    throw new SafetyError("safety guard 不可關閉");
  if (item.status !== "approved" && item.status !== "edited")
    throw new SafetyError(`未經人審核可：status=${item.status}`);
  if (item.rule_flags.length > 0)
    throw new SafetyError(`命中硬規則不可送出：${item.rule_flags.join(",")}`);
  if (!item.target_post) throw new SafetyError("缺少目標貼文");

  const content = (item.edited_draft ?? item.draft).trim();
  if (!content) throw new SafetyError("空白內容");

  await page.goto(item.target_post.url, { waitUntil: "domcontentloaded" });
  await humanPause(2500);

  const sig = await detectRiskSignals(page);
  if (sig.length) return { ok: false, signals: sig };

  const replyTrigger = page
    .locator('svg[aria-label*="回覆"], svg[aria-label*="eply"], div[role="button"]:has-text("回覆")')
    .first();
  await replyTrigger.click({ timeout: 8000 });
  await humanPause(1200);

  const editor = page.locator('div[contenteditable="true"], textarea').first();
  await editor.click();
  for (const ch of content) {
    await editor.type(ch, { delay: 30 + Math.random() * 90 });
  }
  await humanPause(1500);

  const submit = page
    .locator('div[role="button"]:has-text("發佈"), div[role="button"]:has-text("Post")')
    .first();
  await submit.click({ timeout: 8000 });
  await humanPause(3000);

  const postSig = await detectRiskSignals(page);
  return { ok: postSig.length === 0, signals: postSig };
}
