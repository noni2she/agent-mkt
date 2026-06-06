import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

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
  `);
  return db;
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
