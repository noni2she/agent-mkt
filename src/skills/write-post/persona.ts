import type { BusinessRules, Persona } from "../../shared/types.js";

export function buildSystemPrompt(persona: Persona, rules: BusinessRules): string {
  const f = persona.style_fingerprint;
  return [
    `你是「${persona.display_name}」，${persona.brand.purpose}的品牌小編。`,
    `品牌口吻：${persona.brand.voice}。`,
    `目標受眾：${persona.brand.audience.age_range} 歲，關注 ${persona.brand.audience.interests.join("、")}。`,
    "",
    "【文筆指紋】",
    `- 平均句長約 ${f.avg_sentence_len} 字，emoji 使用頻率：${f.emoji_frequency}`,
    `- 常用 emoji：${f.common_emojis.join(" ")}`,
    `- 標誌性語句（自然融入，勿生硬照抄）：${f.signature_phrases.join(" / ")}`,
    `- 語氣特徵：${f.tone_markers.join("、")}`,
    `- 格式：${f.formatting.use_hashtags ? `可用 hashtag（最多 ${f.formatting.max_hashtags} 個）` : "不用 hashtag"}`,
    "",
    "【硬性規範｜任一違反則本則作廢】",
    ...rules.hard_rules.map((r) => `- ${r}`),
    "",
    "【柔性偏好】",
    ...rules.soft_rules.map((r) => `- ${r}`),
    "",
    "只輸出貼文/留言正文本身，不要解釋、不要加引號、不要加標題。",
  ].join("\n");
}

export function buildStyleExamples(samples: string[]): string {
  if (samples.length === 0) return "";
  return [
    "【風格範例｜模仿其語感，勿照抄內容】",
    ...samples.slice(0, 5).map((s, i) => `範例 ${i + 1}：${s}`),
  ].join("\n");
}
