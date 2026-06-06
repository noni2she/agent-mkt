import { z } from "zod";

/** 海巡可生效的過濾條件（min_likes / exclude_keywords；replies/年齡/追蹤數 DOM 不穩，暫不納入）。 */
export const ScoutCriteriaSchema = z.object({
  minLikes: z.number().default(100),
  excludeKeywords: z.array(z.string()).default([]),
  maxAgeHours: z.number().optional(), // 未設 = 不限時效
});
export type ScoutCriteria = z.infer<typeof ScoutCriteriaSchema>;

/** 海巡 budget（先到先停）。 */
export const ScoutBudgetSchema = z.object({
  targetCandidates: z.number().default(10),
  maxScrolls: z.number().default(30),
  maxScanned: z.number().default(60),
});
export type ScoutBudget = z.infer<typeof ScoutBudgetSchema>;

/** 後端 → hands 的指令。 */
export const CommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ping") }),
  z.object({
    action: z.literal("scout"),
    keyword: z.string(),
    serpType: z.enum(["default", "recent"]).optional(), // default=熱門列表；recent=最新
    criteria: ScoutCriteriaSchema.partial().optional(),
    budget: ScoutBudgetSchema.partial().optional(),
  }),
]);
export type Command = z.infer<typeof CommandSchema>;

/** 後端 → hands：包住一個指令，帶 correlation id。 */
export const RequestEnvelopeSchema = z.object({
  type: z.literal("request"),
  id: z.string(),
  command: CommandSchema,
});
export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;

/** hands → 後端：連線時自報租戶。 */
export const HelloSchema = z.object({
  type: z.literal("hello"),
  tenant: z.string(),
});
export type Hello = z.infer<typeof HelloSchema>;

/** hands → 後端：對某個 request 的回應。 */
export const ResponseEnvelopeSchema = z.object({
  type: z.literal("response"),
  id: z.string(),
  status: z.enum(["ok", "fail", "element_not_found"]),
  payload: z.unknown().optional(),
  error: z.string().optional(),
});
export type ResponseEnvelope = z.infer<typeof ResponseEnvelopeSchema>;

/** content script 抓到的候選貼文（MVP 部分欄位 best-effort）。 */
export const ScoutCandidateSchema = z.object({
  id: z.string(),
  url: z.string(),
  author_handle: z.string(),
  text: z.string(),
  likes: z.number(),
  replies: z.number(),
  posted_at: z.string(),
  popular_reason: z.string(),
});
export type ScoutCandidate = z.infer<typeof ScoutCandidateSchema>;

/** hands → 後端 的所有合法訊息。 */
export const ClientMessageSchema = z.union([HelloSchema, ResponseEnvelopeSchema]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** 解析並驗證一則來自 hands 的訊息；非法則 throw。 */
export function parseClientMessage(raw: string): ClientMessage {
  const json = JSON.parse(raw) as unknown;
  return ClientMessageSchema.parse(json);
}
