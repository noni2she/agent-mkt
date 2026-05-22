import { randomUUID } from "node:crypto";
import { loadBusinessRules, loadPersona, env } from "../shared/config.js";
import { history, processed, queue } from "../shared/store.js";
import type { ReviewItem, SessionStats } from "../shared/types.js";
import { generateReply } from "../skills/write-post/generator.js";
import { closeBrowser, ensureLoggedIn, newPage } from "../browser/playwright.js";
import { scoutKeyword } from "../skills/scout/playwright.js";
import { SessionThrottle } from "./throttle.js";

export interface RunOptions {
  styleSamples?: string[];
  maxPerKeyword?: number;
}

export async function runScoutPipeline(opts: RunOptions = {}): Promise<SessionStats> {
  const persona = loadPersona();
  const rules = loadBusinessRules();
  const stats: SessionStats = {
    session_id: randomUUID(),
    started_at: new Date().toISOString(),
    posts_viewed: 0,
    replies_sent: 0,
    approvals: 0,
    rejections: 0,
    detection_signals: [],
  };

  const throttle = new SessionThrottle(
    env.scoutMaxPerMin,
    env.scoutSessionMaxHours,
    rules.safety.cooldown_minutes_between_replies,
  );

  try {
    const page = await newPage();
    const loggedIn = await ensureLoggedIn(page);
    if (!loggedIn) {
      stats.detection_signals.push("not_logged_in");
      return stats;
    }

    for (const kw of rules.popular_criteria.topic_keywords) {
      if (throttle.sessionExpired()) break;
      const { posts, detectionSignals } = await scoutKeyword(
        page,
        kw,
        rules,
        throttle,
        processed.has,
        opts.maxPerKeyword ?? 8,
      );
      stats.detection_signals.push(...detectionSignals);
      if (detectionSignals.length) break;

      for (const post of posts) {
        stats.posts_viewed += 1;
        processed.mark(post.id);
        history.pushScouted(post);

        const { draft, rule_flags } = await generateReply(
          persona,
          rules,
          opts.styleSamples ?? persona.style_fingerprint.signature_phrases,
          post,
        );

        const item: ReviewItem = {
          id: randomUUID(),
          kind: "reply",
          target_post: post,
          draft,
          recommend_reason: post.popular_reason,
          rule_flags,
          status: "pending",
          created_at: new Date().toISOString(),
        };
        queue.add(item);
      }
    }
  } finally {
    history.saveSession(stats);
    await closeBrowser();
  }

  return stats;
}
