import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { BusinessRules, Persona } from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_DIR = join(ROOT, "configs");

export function loadPersona(file = "persona_example.yaml"): Persona {
  return parse(readFileSync(join(CONFIG_DIR, file), "utf8")) as Persona;
}

export function loadBusinessRules(file = "business_rules.yaml"): BusinessRules {
  return parse(readFileSync(join(CONFIG_DIR, file), "utf8")) as BusinessRules;
}

export const env = {
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o",
  pwProfileDir: process.env.PW_PROFILE_DIR ?? ".cdp-profile",
  pwHeadless: process.env.PW_HEADLESS === "true",
  scoutMaxPerMin: Number(process.env.SCOUT_MAX_POSTS_PER_MIN ?? 8),
  scoutSessionMaxHours: Number(process.env.SCOUT_SESSION_MAX_HOURS ?? 3),
  reviewBatchMax: Number(process.env.REVIEW_BATCH_MAX ?? 15),
  reviewApprovalRateWarn: Number(process.env.REVIEW_APPROVAL_RATE_WARN ?? 0.95),
};
