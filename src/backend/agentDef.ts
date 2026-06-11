import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentDef } from "../core/prompt.js";

/** 讀 4 份 agent 定義 md（僅作 DB 首次 seed 的預設來源）。 */
export function loadAgentDefFromFiles(dir = process.env.AGENT_DIR ?? "configs/agent"): AgentDef {
  const read = (f: string) => readFileSync(join(dir, f), "utf8").trim();
  return {
    persona: read("persona.md"),
    ownedProduct: read("owned_product.md"),
    marketingStrategy: read("marketing_strategy.md"),
    contentWritingRule: read("content_writing_rule.md"),
  };
}
