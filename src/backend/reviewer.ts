import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { ScoutCandidate } from "../core/protocol.js";
import { buildReviewerInstructions, type AgentDef } from "../core/prompt.js";

export const ReviewOutputSchema = z.object({
  relevant: z.boolean(),
  reason: z.string(),
  draft: z.string(),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

/** 對一篇候選貼文：判斷相關性 + 寫草稿（單次 LLM 呼叫，每篇 token 上限）。 */
export async function reviewCandidate(
  candidate: ScoutCandidate,
  def: AgentDef,
  keyword: string,
): Promise<ReviewOutput> {
  const agent = new Agent({
    name: "reply-reviewer",
    instructions: buildReviewerInstructions(def, keyword),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    outputType: ReviewOutputSchema,
    modelSettings: { maxTokens: 1000 },
  });
  const input = `貼文（作者 @${candidate.author_handle}，👍${candidate.likes}）：\n${candidate.text}`;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await run(agent, input);
      return result.finalOutput as ReviewOutput;
    } catch (e) {
      lastErr = e; // 結構化輸出偶發 JSON 失敗 → 重試一次
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
