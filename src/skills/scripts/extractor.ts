import type { Persona } from "../../shared/types.js";

export interface StyleStats {
  sample_count: number;
  avg_sentence_len: number;
  emoji_frequency: Persona["style_fingerprint"]["emoji_frequency"];
  top_emojis: string[];
  uses_hashtags: boolean;
  avg_hashtags: number;
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function sentences(text: string): string[] {
  return text
    .split(/[。！？\.\!\?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractStyleStats(texts: string[]): StyleStats {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) {
    return {
      sample_count: 0,
      avg_sentence_len: 0,
      emoji_frequency: "none",
      top_emojis: [],
      uses_hashtags: false,
      avg_hashtags: 0,
    };
  }

  let sentLenSum = 0;
  let sentCount = 0;
  let emojiTotal = 0;
  let hashtagTotal = 0;
  const emojiFreq = new Map<string, number>();

  for (const t of clean) {
    for (const s of sentences(t)) {
      sentLenSum += [...s].length;
      sentCount += 1;
    }
    const emojis = t.match(EMOJI_RE) ?? [];
    emojiTotal += emojis.length;
    for (const e of emojis) emojiFreq.set(e, (emojiFreq.get(e) ?? 0) + 1);
    hashtagTotal += (t.match(/#[^\s#]+/g) ?? []).length;
  }

  const emojiPerPost = emojiTotal / clean.length;
  const emoji_frequency: StyleStats["emoji_frequency"] =
    emojiPerPost === 0 ? "none" : emojiPerPost < 1 ? "low" : emojiPerPost < 3 ? "medium" : "high";

  return {
    sample_count: clean.length,
    avg_sentence_len: sentCount ? Math.round(sentLenSum / sentCount) : 0,
    emoji_frequency,
    top_emojis: [...emojiFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([e]) => e),
    uses_hashtags: hashtagTotal > 0,
    avg_hashtags: Math.round((hashtagTotal / clean.length) * 10) / 10,
  };
}

export function applyStatsToPersona(persona: Persona, stats: StyleStats): Persona {
  if (stats.sample_count === 0) return persona;
  return {
    ...persona,
    style_fingerprint: {
      ...persona.style_fingerprint,
      avg_sentence_len: stats.avg_sentence_len,
      emoji_frequency: stats.emoji_frequency,
      common_emojis: stats.top_emojis.length
        ? stats.top_emojis
        : persona.style_fingerprint.common_emojis,
      formatting: {
        ...persona.style_fingerprint.formatting,
        use_hashtags: stats.uses_hashtags,
      },
    },
  };
}
