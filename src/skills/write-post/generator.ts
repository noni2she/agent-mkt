import OpenAI from "openai";
import type { BusinessRules, Persona, ScoutedPost } from "../../shared/types.js";
import { env } from "../../shared/config.js";
import { buildStyleExamples, buildSystemPrompt } from "./persona.js";

let client: OpenAI | null = null;
function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiKey });
  return client;
}

export interface GenResult {
  draft: string;
  rule_flags: string[];
}

export function checkHardRules(text: string, rules: BusinessRules): string[] {
  const flags: string[] = [];
  const banned = ["最", "第一", "絕對", "保證", "根治", "療效"];
  for (const w of banned) if (text.includes(w)) flags.push(`誇大用語: ${w}`);
  if (/https?:\/\/|www\.|\S+\.(com|tw|io|ai)\b/i.test(text)) flags.push("含外部連結");
  if (/AI生成|自動回覆|機器人|bot/i.test(text)) flags.push("疑似揭露自動化");
  void rules;
  return flags;
}

async function generate(
  persona: Persona,
  rules: BusinessRules,
  styleSamples: string[],
  task: string,
): Promise<GenResult> {
  const system = buildSystemPrompt(persona, rules);
  const examples = buildStyleExamples(styleSamples);

  const res = await openai().chat.completions.create({
    model: env.openaiModel,
    temperature: 0.8,
    messages: [
      { role: "system", content: system },
      ...(examples ? [{ role: "system" as const, content: examples }] : []),
      { role: "user", content: task },
    ],
  });

  const draft = (res.choices[0]?.message?.content ?? "").trim();
  return { draft, rule_flags: checkHardRules(draft, rules) };
}

export function generatePost(
  persona: Persona,
  rules: BusinessRules,
  styleSamples: string[],
  brief: string,
): Promise<GenResult> {
  return generate(
    persona,
    rules,
    styleSamples,
    `請依以下素材撰寫一則 Threads 貼文：\n${brief}`,
  );
}

export function generateReply(
  persona: Persona,
  rules: BusinessRules,
  styleSamples: string[],
  post: ScoutedPost,
): Promise<GenResult> {
  const ctx = [
    `原文作者：@${post.author_handle}`,
    `原文內容：${post.text}`,
    post.thread_excerpt.length
      ? `留言串氣氛取樣：${post.thread_excerpt.join(" ｜ ")}`
      : "",
    "",
    `請以小編身分留下一則自然、貼合語境的回覆（${persona.reply_habits.length} 長度）。`,
    "回覆要先呼應原文，再帶出品牌關聯，但不可硬推銷。",
  ]
    .filter(Boolean)
    .join("\n");
  return generate(persona, rules, styleSamples, ctx);
}
