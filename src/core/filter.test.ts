import { describe, it, expect } from "vitest";
import { parseCount, isPopular } from "./filter.js";
import type { BusinessRules, ScoutedPost } from "./types.js";

const rules: BusinessRules = {
  hard_rules: [],
  soft_rules: [],
  popular_criteria: {
    min_likes: 100,
    min_replies: 50,
    max_post_age_hours: 24,
    min_author_followers: 0,
    scout_target_per_keyword: 10,
    topic_keywords: [],
    exclude_keywords: ["業配"],
  },
  safety: {
    require_human_approval_before_send: true,
    max_replies_per_session: 10,
    cooldown_minutes_between_replies: [3, 8],
  },
};

const base: Omit<ScoutedPost, "is_popular" | "popular_reason"> = {
  id: "1",
  url: "u",
  author_handle: "a",
  author_followers: null,
  text: "正常內容",
  likes: 200,
  replies: 80,
  posted_at: new Date().toISOString(),
  thread_excerpt: [],
};

describe("parseCount", () => {
  it("parses plain numbers and commas", () => {
    expect(parseCount("1,234")).toBe(1234);
  });
  it("parses 萬 and k units", () => {
    expect(parseCount("1.5萬")).toBe(15000);
    expect(parseCount("2k")).toBe(2000);
  });
  it("returns 0 for null", () => {
    expect(parseCount(null)).toBe(0);
  });
});

describe("isPopular", () => {
  it("accepts a post over thresholds", () => {
    expect(isPopular(base, rules).ok).toBe(true);
  });
  it("rejects low likes", () => {
    expect(isPopular({ ...base, likes: 10 }, rules).ok).toBe(false);
  });
  it("rejects excluded keyword", () => {
    expect(isPopular({ ...base, text: "這是業配文" }, rules).ok).toBe(false);
  });
  it("rejects old posts", () => {
    const old = new Date(Date.now() - 48 * 3600_000).toISOString();
    expect(isPopular({ ...base, posted_at: old }, rules).ok).toBe(false);
  });
});
