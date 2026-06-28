import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
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
    CREATE TABLE IF NOT EXISTS tenant (
      tenant_id TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      threads_handle TEXT NOT NULL,
      onboarded_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS threads_account (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      handle TEXT NOT NULL,
      display_name TEXT NOT NULL,
      persona TEXT NOT NULL DEFAULT '',
      marketing_strategy TEXT NOT NULL DEFAULT '',
      content_writing_rule TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_threads_account_tenant
      ON threads_account(tenant_id) WHERE deleted_at IS NULL;
  `);
  try {
    db.exec(`ALTER TABLE review_item ADD COLUMN previewing_at TEXT;`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column/i.test(msg)) throw e;
  }
  try {
    db.exec(`ALTER TABLE tenant_config ADD COLUMN active_threads_account_id TEXT;`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column/i.test(msg)) throw e;
  }
  try {
    db.exec(`ALTER TABLE review_item ADD COLUMN threads_account_id TEXT;`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column/i.test(msg)) throw e;
  }
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
    .prepare(
      `INSERT INTO tenant_config (tenant_id, config_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         config_json = excluded.config_json,
         updated_at = excluded.updated_at`,
    )
    .run(tenant, JSON.stringify(config), new Date().toISOString());
}

export interface ThreadsAccount {
  id: string;
  tenant_id: string;
  handle: string;
  display_name: string;
  persona: string;
  marketing_strategy: string;
  content_writing_rule: string;
  created_at: string;
}

export function listThreadsAccounts(tenant: string): ThreadsAccount[] {
  return getDb()
    .prepare(
      `SELECT id, tenant_id, handle, display_name, persona, marketing_strategy,
              content_writing_rule, created_at
       FROM threads_account
       WHERE tenant_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC`,
    )
    .all(tenant) as ThreadsAccount[];
}

export function getThreadsAccount(id: string): ThreadsAccount | null {
  const row = getDb()
    .prepare(
      `SELECT id, tenant_id, handle, display_name, persona, marketing_strategy,
              content_writing_rule, created_at
       FROM threads_account
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(id) as ThreadsAccount | undefined;
  return row ?? null;
}

export function createThreadsAccount(input: Omit<ThreadsAccount, "id" | "created_at">): ThreadsAccount {
  const account: ThreadsAccount = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `INSERT INTO threads_account
       (id, tenant_id, handle, display_name, persona, marketing_strategy, content_writing_rule, created_at)
       VALUES (@id, @tenant_id, @handle, @display_name, @persona, @marketing_strategy, @content_writing_rule, @created_at)`,
    )
    .run(account);
  return account;
}

type ThreadsAccountPatch = Partial<
  Pick<ThreadsAccount, "display_name" | "persona" | "marketing_strategy" | "content_writing_rule">
>;

export function updateThreadsAccount(id: string, patch: ThreadsAccountPatch): void {
  const columns: Array<keyof ThreadsAccountPatch> = [
    "display_name",
    "persona",
    "marketing_strategy",
    "content_writing_rule",
  ];
  const entries = columns
    .filter((column) => patch[column] !== undefined)
    .map((column) => [column, patch[column]] as const);
  if (entries.length === 0) return;
  getDb()
    .prepare(`UPDATE threads_account SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`)
    .run(...entries.map(([, value]) => value), id);
}

export function softDeleteThreadsAccount(id: string): void {
  getDb().prepare(`UPDATE threads_account SET deleted_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}

export function getActiveAccountId(tenant: string): string | null {
  const row = getDb()
    .prepare(`SELECT active_threads_account_id FROM tenant_config WHERE tenant_id = ?`)
    .get(tenant) as { active_threads_account_id: string | null } | undefined;
  return row?.active_threads_account_id ?? null;
}

export function setActiveAccountId(tenant: string, accountId: string | null): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO tenant_config (tenant_id, config_json, updated_at, active_threads_account_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         active_threads_account_id = excluded.active_threads_account_id,
         updated_at = excluded.updated_at`,
    )
    .run(tenant, JSON.stringify(DEFAULT_CONFIG), now, accountId);
}

export function getActiveAccount(tenant: string): ThreadsAccount | null {
  const accountId = getActiveAccountId(tenant);
  return accountId ? getThreadsAccount(accountId) : null;
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

export interface TenantInfo {
  brandName: string;
  threadsHandle: string;
  onboarded: boolean;
}

/** 取租戶身分。無 row 視為尚未 onboarded。 */
export function getTenant(tenant: string): TenantInfo {
  const row = getDb()
    .prepare(`SELECT brand_name, threads_handle, onboarded_at FROM tenant WHERE tenant_id = ?`)
    .get(tenant) as { brand_name: string; threads_handle: string; onboarded_at: string | null } | undefined;
  if (!row) return { brandName: "", threadsHandle: "", onboarded: false };
  return { brandName: row.brand_name, threadsHandle: row.threads_handle, onboarded: row.onboarded_at != null };
}

export interface OnboardInput {
  brandName: string;
  threadsHandle: string;
  ownedProduct: string;
}

/** 完成 onboarding：驗證必填 → 寫 tenant 身分 → 用預設 + 使用者 owned_product 建 agent_def。 */
export function onboardTenant(tenant: string, input: OnboardInput): void {
  if (!input.brandName.trim() || !input.threadsHandle.trim() || !input.ownedProduct.trim()) {
    throw new Error("brandName, threadsHandle, ownedProduct are required");
  }
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO tenant (tenant_id, brand_name, threads_handle, onboarded_at, created_at)
       VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM tenant WHERE tenant_id = ?), ?))`,
    )
    .run(tenant, input.brandName.trim(), input.threadsHandle.trim(), now, tenant, now);
  const defaults = loadAgentDefFromFiles();
  setAgentDef(tenant, { ...defaults, ownedProduct: input.ownedProduct.trim() });
}

export interface ReviewItemRow {
  id: string;
  tenant_id: string;
  threads_account_id: string;
  kind: string;
  post_id: string;
  post_json: string;
  relevant: number;
  reason: string;
  draft: string;
  status: string;
  created_at: string;
  previewing_at?: string | null;
}

export function saveReviewItem(row: ReviewItemRow): void {
  if (row.relevant !== 1 || !row.draft.trim()) return;
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO review_item
       (id, tenant_id, threads_account_id, kind, post_id, post_json, relevant, reason, draft, status, created_at)
       VALUES (@id, @tenant_id, @threads_account_id, @kind, @post_id, @post_json, @relevant, @reason, @draft, @status, @created_at)`,
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

/** 取某租戶指定 Threads 帳號的審核項目，新到舊。 */
export function getReviews(tenant: string, accountId?: string | null): ReviewListItem[] {
  const accountFilter = accountId === undefined ? "" : " AND threads_account_id = ?";
  const params = accountId === undefined ? [tenant] : [tenant, accountId];
  const rows = getDb()
    .prepare(
      `SELECT id, post_json, relevant, reason, draft, status, created_at
       FROM review_item
       WHERE tenant_id = ?${accountFilter} AND relevant = 1 AND TRIM(COALESCE(draft, '')) != ''
       ORDER BY created_at DESC`,
    )
    .all(...params) as Array<{ id: string; post_json: string; relevant: number; reason: string; draft: string; status: string; created_at: string }>;
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

/** 更新一筆 review_item 的 status、draft 與/或 previewing_at。 */
export function updateReviewItem(id: string, patch: { status?: string; draft?: string; previewing_at?: string | null }): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.status !== undefined) { sets.push("status = ?"); vals.push(patch.status); }
  if (patch.draft !== undefined) { sets.push("draft = ?"); vals.push(patch.draft); }
  if (patch.previewing_at !== undefined) { sets.push("previewing_at = ?"); vals.push(patch.previewing_at); }
  if (!sets.length) return;
  vals.push(id);
  getDb().prepare(`UPDATE review_item SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

/** 是否已有 dry-run 草稿正在等待人工確認。 */
export function hasPreviewing(tenant: string, accountId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM review_item
       WHERE tenant_id = ? AND threads_account_id = ? AND status = 'previewing'
       LIMIT 1`,
    )
    .get(tenant, accountId);
  return row != null;
}

/** 將逾時的 previewing 項目標成 skipped，回傳清掃筆數。 */
export function sweepStalePreviews(tenant: string, accountId: string, timeoutMin: number): number {
  const cutoff = new Date(Date.now() - timeoutMin * 60_000).toISOString();
  const result = getDb()
    .prepare(
      `UPDATE review_item
       SET status = 'skipped'
       WHERE tenant_id = ? AND threads_account_id = ? AND status = 'previewing' AND previewing_at < ?`,
    )
    .run(tenant, accountId, cutoff);
  return result.changes;
}

export interface ReviewItemLookup {
  id: string;
  tenant_id: string;
  status: string;
  postUrl: string;
  draft: string;
}

/** 取單筆 review_item，供狀態推進端點驗證租戶與目前狀態。 */
export function getReviewItem(id: string): ReviewItemLookup | null {
  const row = getDb()
    .prepare(`SELECT id, tenant_id, status, post_json, draft FROM review_item WHERE id = ?`)
    .get(id) as { id: string; tenant_id: string; status: string; post_json: string; draft: string | null } | undefined;
  if (!row) return null;
  let postUrl = "";
  try {
    const post = JSON.parse(row.post_json) as { url?: string };
    postUrl = post.url ?? "";
  } catch {}
  return { id: row.id, tenant_id: row.tenant_id, status: row.status, postUrl, draft: row.draft ?? "" };
}

export interface NextApproved {
  id: string;
  postUrl: string;
  draft: string;
}

/** 取最舊一筆 status='approved' 的審核項，給 poster 發送；無則 null。 */
export function getNextApproved(tenant: string, accountId: string): NextApproved | null {
  const row = getDb()
    .prepare(
      `SELECT id, post_json, draft FROM review_item
       WHERE tenant_id = ? AND threads_account_id = ?
         AND status = 'approved' AND TRIM(COALESCE(draft,'')) != ''
       ORDER BY created_at ASC LIMIT 1`,
    )
    .get(tenant, accountId) as { id: string; post_json: string; draft: string } | undefined;
  if (!row) return null;
  try {
    const post = JSON.parse(row.post_json) as { url?: string };
    if (!post.url) return null;
    return { id: row.id, postUrl: post.url, draft: row.draft };
  } catch {
    return null;
  }
}
