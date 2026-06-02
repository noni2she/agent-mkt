import type { BusinessRules, ScoutedPost } from "./types.js";

export function parseCount(s: string | null): number {
  if (!s) return 0;
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([萬kKwW]?)/);
  if (!m) return 0;
  const n = parseFloat(m[1] ?? "0");
  const unit = (m[2] ?? "").toLowerCase();
  if (unit === "萬" || unit === "w") return Math.round(n * 10000);
  if (unit === "k") return Math.round(n * 1000);
  return Math.round(n);
}

/** Popular 判定：海巡路線共用，確保一致性 */
export function isPopular(
  p: Omit<ScoutedPost, "is_popular" | "popular_reason">,
  rules: BusinessRules,
): { ok: boolean; reason: string } {
  const c = rules.popular_criteria;
  const ageH = (Date.now() - new Date(p.posted_at).getTime()) / 3600_000;
  const reasons: string[] = [];
  if (p.likes < c.min_likes) return { ok: false, reason: `讚數不足(${p.likes})` };
  if (p.replies < c.min_replies) return { ok: false, reason: `留言不足(${p.replies})` };
  if (ageH > c.max_post_age_hours) return { ok: false, reason: `太舊(${Math.round(ageH)}h)` };
  if (c.exclude_keywords.some((k) => p.text.includes(k)))
    return { ok: false, reason: "命中排除關鍵字" };
  reasons.push(`👍${p.likes}/💬${p.replies}`, `${Math.round(ageH)}h內`);
  return { ok: true, reason: `popular: ${reasons.join(" ")}` };
}
