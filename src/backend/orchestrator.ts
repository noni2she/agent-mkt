import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import type { ScoutCandidate } from "../core/protocol.js";
import { loadPersona } from "./persona.js";
import { reviewCandidate } from "./reviewer.js";

export interface ReviewRecord {
  id: string;
  kind: "reply";
  post: ScoutCandidate;
  relevant: boolean;
  reason: string;
  draft: string;
  status: "pending";
  created_at: string;
}

/** 對一批 scout 候選跑 LLM 判斷+草稿，寫 data/review-queue.json，回傳相關的。 */
export async function runReview(candidates: ScoutCandidate[], keyword: string): Promise<ReviewRecord[]> {
  const persona = loadPersona();
  const records: ReviewRecord[] = [];
  for (const c of candidates) {
    console.log(`  ▸ @${c.author_handle} 👍${c.likes}：${c.text.slice(0, 70).replace(/\n/g, " ")}…`);
    try {
      const r = await reviewCandidate(c, persona, keyword);
      records.push({
        id: randomUUID(),
        kind: "reply",
        post: c,
        relevant: r.relevant,
        reason: r.reason,
        draft: r.draft,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      console.log(`     ${r.relevant ? "✅相關" : "⛔不相關"} — ${r.reason}`);
      if (r.relevant) console.log(`     → ${r.draft}`);
    } catch (e) {
      console.warn(`     ⚠️ review 失敗：${(e as Error).message}（原文見上行）`);
    }
  }
  const relevant = records.filter((r) => r.relevant);
  mkdirSync("data", { recursive: true });
  writeFileSync("data/review-queue.json", JSON.stringify(relevant, null, 2), "utf8");
  console.log(`[review] ${candidates.length} 篇 → 相關 ${relevant.length} 篇，已寫入 data/review-queue.json`);
  return relevant;
}
