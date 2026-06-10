import { randomUUID } from "node:crypto";
import type { ScoutCandidate } from "../core/protocol.js";
import { loadAgentDef } from "./agentDef.js";
import { reviewCandidate } from "./reviewer.js";
import { saveReviewItem } from "./store.js";

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

/** 對一批 scout 候選跑 LLM 判斷+草稿，存 SQLite，回傳相關的。 */
export async function runReview(candidates: ScoutCandidate[], keyword: string, tenant: string): Promise<ReviewRecord[]> {
  const def = loadAgentDef();
  const records: ReviewRecord[] = [];
  for (const c of candidates) {
    console.log(`  ▸ @${c.author_handle} 👍${c.likes}：${c.text.slice(0, 70).replace(/\n/g, " ")}…`);
    try {
      const r = await reviewCandidate(c, def, keyword);
      const rec = {
        id: randomUUID(),
        kind: "reply" as const,
        post: c,
        relevant: r.relevant,
        reason: r.reason,
        draft: r.draft,
        status: "pending" as const,
        created_at: new Date().toISOString(),
      };
      records.push(rec);
      saveReviewItem({
        id: rec.id,
        tenant_id: tenant,
        kind: rec.kind,
        post_id: c.id,
        post_json: JSON.stringify(c),
        relevant: r.relevant ? 1 : 0,
        reason: r.reason,
        draft: r.draft,
        status: rec.status,
        created_at: rec.created_at,
      });
      console.log(`     ${r.relevant ? "✅相關" : "⛔不相關"} — ${r.reason}`);
      if (r.relevant) console.log(`     → ${r.draft}`);
    } catch (e) {
      console.warn(`     ⚠️ review 失敗：${(e as Error).message}（原文見上行）`);
    }
  }
  const relevant = records.filter((r) => r.relevant);
  console.log(`[review] ${candidates.length} 篇 → 相關 ${relevant.length} 篇，已存 SQLite`);
  return relevant;
}
