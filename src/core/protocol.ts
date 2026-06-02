import { z } from "zod";

/** 後端 → hands 的指令。Plan 1 僅 ping；後續計畫擴充此 union。 */
export const CommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ping") }),
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

/** hands → 後端 的所有合法訊息。 */
export const ClientMessageSchema = z.union([HelloSchema, ResponseEnvelopeSchema]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** 解析並驗證一則來自 hands 的訊息；非法則 throw。 */
export function parseClientMessage(raw: string): ClientMessage {
  const json = JSON.parse(raw) as unknown;
  return ClientMessageSchema.parse(json);
}
