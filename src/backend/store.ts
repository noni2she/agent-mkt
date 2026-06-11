import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import type { AgentDef } from "../core/prompt.js";
import { loadAgentDefFromFiles } from "./agentDef.js";

let db: Database.Database | null = null;

/** 取得 SQLite 連線（singleton），首次建表。 */
export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync("data", { recursive: true });
  db = new Database(process.env.DB_FILE ?? "data/agent-mkt.db");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_item (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      post_id TEXT NOT NULL,
      post_json TEXT NOT NULL,
      relevant INTEGER NOT NULL,
      reason TEXT,
      draft TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS processed_id (
      tenant_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      scouted_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, post_id)
    );
    CREATE TABLE IF NOT EXISTS tenant_config (
      tenant_id TEXT PRIMARY KEY,
      config_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_def (
      tenant_id TEXT PRIMARY KEY,
      persona TEXT NOT NULL,
      owned_product TEXT NOT NULL,
      marketing_strategy TEXT NOT NULL,
      content_writing_rule TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

export interface TenantConfig {
  keywords: string[];
  minLikes: number;
  maxAgeHours: number | null;
  targetRelevant: number;
  excludeKeywords: string[];
  serpType: "default" | "recent";
}

const DEFAULT_CONFIG: TenantConfig = {
  keywords: ["房地產"],
  minLikes: 100,
  maxAgeHours: 720,
  targetRelevant: 3,
  excludeKeywords: [],
  serpType: "default",
};

export function getTenantConfig(tenant: string): TenantConfig {
  const row = getDb().prepare(`SELECT config_json FROM tenant_config WHERE tenant_id = ?`).get(tenant) as
    | { config_json: string }
    | undefined;
  return row ? { ...DEFAULT_CONFIG, ...JSON.parse(row.config_json) } : DEFAULT_CONFIG;
}

export function setTenantConfig(tenant: string, config: TenantConfig): void {
  getDb()
    .prepare(`INSERT OR REPLACE INTO tenant_config (tenant_id, config_json, updated_at) VALUES (?, ?, ?)`)
    .run(tenant, JSON.stringify(config), new Date().toISOString());
}

/** 取某租戶的 agent 定義。DB 無資料時用 configs/agent/*.md seed 後回傳。 */
export function getAgentDef(tenant: string): AgentDef {
  const d = getDb();
  const row = d
    .prepare(`SELECT persona, owned_product, marketing_strategy, content_writing_rule FROM agent_def WHERE tenant_id = ?`)
    .get(tenant) as
    | { persona: string; owned_product: string; marketing_strategy: string; content_writing_rule: string }
    | undefined;
  if (row) {
    return {
      persona: row.persona,
      ownedProduct: row.owned_product,
      marketingStrategy: row.marketing_strategy,
      contentWritingRule: row.content_writing_rule,
    };
  }
  const seed = loadAgentDefFromFiles();
  setAgentDef(tenant, seed);
  return seed;
}

/** 寫入某租戶的 agent 定義。 */
export function setAgentDef(tenant: string, def: AgentDef): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO agent_def
       (tenant_id, persona, owned_product, marketing_strategy, content_writing_rule, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(tenant, def.persona, def.ownedProduct, def.marketingStrategy, def.contentWritingRule, new Date().toISOString());
}

export interface ReviewItemRow {
  id: string;
  tenant_id: string;
  kind: string;
  post_id: string;
  post_json: string;
  relevant: number;
  reason: string;
  draft: string;
  status: string;
  created_at: string;
}

export function saveReviewItem(row: ReviewItemRow): void {
  if (row.relevant !== 1 || !row.draft.trim()) return;
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO review_item
       (id, tenant_id, kind, post_id, post_json, relevant, reason, draft, status, created_at)
       VALUES (@id, @tenant_id, @kind, @post_id, @post_json, @relevant, @reason, @draft, @status, @created_at)`,
    )
    .run(row);
}

/** 標記一批貼文已處理（去重用）。 */
export function markProcessed(tenant: string, ids: string[]): void {
  const d = getDb();
  const stmt = d.prepare(`INSERT OR IGNORE INTO processed_id (tenant_id, post_id, scouted_at) VALUES (?, ?, ?)`);
  const now = new Date().toISOString();
  const tx = d.transaction((arr: string[]) => {
    for (const id of arr) stmt.run(tenant, id, now);
  });
  tx(ids);
}

/** 取某租戶所有已處理的 post_id。 */
export function getProcessedIds(tenant: string): string[] {
  const rows = getDb().prepare(`SELECT post_id FROM processed_id WHERE tenant_id = ?`).all(tenant) as Array<{
    post_id: string;
  }>;
  return rows.map((r) => r.post_id);
}

export interface ReviewListItem {
  id: string;
  post: unknown; // ScoutCandidate（由 post_json 解析）
  relevant: boolean;
  reason: string;
  draft: string;
  status: string;
  created_at: string;
}

/** 取某租戶所有審核項目，新到舊。 */
export function getReviews(tenant: string): ReviewListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT id, post_json, relevant, reason, draft, status, created_at
       FROM review_item
       WHERE tenant_id = ? AND relevant = 1 AND TRIM(COALESCE(draft, '')) != ''
       ORDER BY created_at DESC`,
    )
    .all(tenant) as Array<{ id: string; post_json: string; relevant: number; reason: string; draft: string; status: string; created_at: string }>;
  return rows.map((r) => ({
    id: r.id,
    post: JSON.parse(r.post_json),
    relevant: r.relevant === 1,
    reason: r.reason,
    draft: r.draft,
    status: r.status,
    created_at: r.created_at,
  }));
}

/** 更新一筆 review_item 的 status 與/或 draft。 */
export function updateReviewItem(id: string, patch: { status?: string; draft?: string }): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.status !== undefined) { sets.push("status = ?"); vals.push(patch.status); }
  if (patch.draft !== undefined) { sets.push("draft = ?"); vals.push(patch.draft); }
  if (!sets.length) return;
  vals.push(id);
  getDb().prepare(`UPDATE review_item SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}
