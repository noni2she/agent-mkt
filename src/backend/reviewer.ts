import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { Persona } from "../core/types.js";
import type { ScoutCandidate } from "../core/protocol.js";
import { buildReviewerInstructions } from "../core/prompt.js";

export const ReviewOutputSchema = z.object({
  relevant: z.boolean(),
  reason: z.string(),
  draft: z.string(),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

/** 對一篇候選貼文：判斷相關性 + 寫草稿（單次 LLM 呼叫，每篇 token 上限）。 */
export async function reviewCandidate(
  candidate: ScoutCandidate,
  persona: Persona,
  keyword: string,
): Promise<ReviewOutput> {
  const agent = new Agent({
    name: "reply-reviewer",
    instructions: buildReviewerInstructions(persona, keyword),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    outputType: ReviewOutputSchema,
    modelSettings: { maxTokens: 500 },
  });
  const input = `貼文（作者 @${candidate.author_handle}，👍${candidate.likes}）：\n${candidate.text}`;
  const result = await run(agent, input);
  return result.finalOutput as ReviewOutput;
}
