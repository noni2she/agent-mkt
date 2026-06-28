import { randomUUID } from "node:crypto";
import { getDb } from "./store.js";

interface LegacyAgentDef {
  persona: string;
  marketing_strategy: string;
  content_writing_rule: string;
}

/** 將既有單帳號資料搬到該租戶的預設 Threads 帳號。 */
export function runDefaultAccountMigration(tenant: string): void {
  const db = getDb();

  db.transaction(() => {
    const tenantRow = db
      .prepare(`SELECT brand_name FROM tenant WHERE tenant_id = ?`)
      .get(tenant) as { brand_name: string } | undefined;
    if (!tenantRow) return;

    const existing = db
      .prepare(
        `SELECT 1
         FROM threads_account
         WHERE tenant_id = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get(tenant);
    if (existing) return;

    const legacy = db
      .prepare(
        `SELECT persona, marketing_strategy, content_writing_rule
         FROM agent_def
         WHERE tenant_id = ?`,
      )
      .get(tenant) as LegacyAgentDef | undefined;

    const accountId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO threads_account
       (id, tenant_id, handle, display_name, persona, marketing_strategy, content_writing_rule, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      accountId,
      tenant,
      "default",
      tenantRow.brand_name || "預設帳號",
      legacy?.persona ?? "",
      legacy?.marketing_strategy ?? "",
      legacy?.content_writing_rule ?? "",
      now,
    );

    db.prepare(
      `INSERT INTO tenant_config
       (tenant_id, config_json, updated_at, active_threads_account_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         active_threads_account_id = excluded.active_threads_account_id,
         updated_at = excluded.updated_at`,
    ).run(tenant, "{}", now, accountId);

    db.prepare(
      `UPDATE review_item
       SET threads_account_id = ?
       WHERE tenant_id = ? AND threads_account_id IS NULL`,
    ).run(accountId, tenant);

    // agent_def is one wide row in the current schema. Preserve owned_product
    // and clear the three values that are now owned by threads_account.
    db.prepare(
      `UPDATE agent_def
       SET persona = '', marketing_strategy = '', content_writing_rule = '', updated_at = ?
       WHERE tenant_id = ?`,
    ).run(now, tenant);
  })();
}
