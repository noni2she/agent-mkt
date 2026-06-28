import type { CommandQueue } from "./commandQueue.js";
import type { ScoutCandidate, ScoutCriteria, ScoutBudget } from "../core/protocol.js";
import { runReview } from "./orchestrator.js";
import { getActiveAccount, markProcessed, getProcessedIds } from "./store.js";

export interface ScoutReviewOpts {
  keyword: string;
  serpType?: "default" | "recent";
  criteria: Partial<ScoutCriteria>;
  budget: Partial<ScoutBudget>;
  targetRelevant: number;
  maxRounds?: number;
}

/** scout → LLM 篩 → 相關不足量就再 scout（跳過已處理），直到達標/達輪數/無新貼文。 */
export async function scoutAndReview(queue: CommandQueue, tenant: string, opts: ScoutReviewOpts): Promise<number> {
  const account = getActiveAccount(tenant);
  if (!account) throw new Error("no active threads account; complete setup first");

  const maxRounds = opts.maxRounds ?? 5;
  const fresh = process.env.DEV_FRESH === "1"; // dev：忽略歷史已處理，方便重測
  let totalRelevant = 0;

  for (let round = 1; round <= maxRounds; round++) {
    if (queue.isScoutStopped(tenant)) {
      console.log("[refill] 海巡已中止，停止補量");
      break;
    }
    const excludeIds = fresh ? [] : getProcessedIds(tenant);
    const remaining = opts.targetRelevant - totalRelevant; // 本輪只撈缺額，省 LLM 呼叫
    const roundBudget = { ...opts.budget, targetCandidates: Math.max(remaining, 1) };
    console.log(`[refill] 第 ${round}/${maxRounds} 輪 scout（缺 ${remaining} 篇、排除 ${excludeIds.length} 篇已處理）…`);
    const res = await queue.enqueue(
      tenant,
      {
        action: "scout",
        keyword: opts.keyword,
        serpType: opts.serpType,
        criteria: opts.criteria,
        budget: roundBudget,
        excludeIds,
      },
      60_000,
    );
    if (queue.isScoutStopped(tenant)) {
      console.log("[refill] 海巡已中止，略過本輪審核");
      break;
    }
    if (res.status === "element_not_found") {
      console.warn(`[refill] ⚠️ 選擇器疑似失效：${res.error}，停止`);
      break;
    }
    const posts = (Array.isArray(res.payload) ? res.payload : []) as ScoutCandidate[];
    if (!posts.length) {
      console.log("[refill] 本輪無新貼文，停止");
      break;
    }
    markProcessed(tenant, posts.map((p) => p.id));
    const relevant = await runReview(posts, opts.keyword, tenant, account);
    totalRelevant += relevant.length;
    console.log(`[refill] 第 ${round} 輪：${posts.length} 篇 → 相關 ${relevant.length}（累計 ${totalRelevant}/${opts.targetRelevant}）`);
    if (totalRelevant >= opts.targetRelevant) {
      console.log(`[refill] ✅ 已達目標相關數 ${opts.targetRelevant}`);
      break;
    }
  }
  console.log(`[refill] 結束：共 ${totalRelevant} 篇相關（目標 ${opts.targetRelevant}）`);
  return totalRelevant;
}
