import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tenant = "us";
const originalDbFile = process.env.DB_FILE;

beforeEach(() => {
  process.env.DB_FILE = ":memory:";
  vi.resetModules();
});

afterEach(() => {
  if (originalDbFile === undefined) delete process.env.DB_FILE;
  else process.env.DB_FILE = originalDbFile;
  vi.resetModules();
});

async function loadFreshDatabase() {
  const [{ getDb }, { runDefaultAccountMigration }] = await Promise.all([
    import("./store.js"),
    import("./storeMigration.js"),
  ]);
  return { db: getDb(), runDefaultAccountMigration };
}

function seedLegacyInstall(db: Database.Database): void {
  const now = "2026-06-29T00:00:00.000Z";
  db.prepare(
    `INSERT INTO tenant (tenant_id, brand_name, threads_handle, onboarded_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(tenant, "Legacy Brand", "legacy", now, now);
  db.prepare(
    `INSERT INTO agent_def
     (tenant_id, persona, owned_product, marketing_strategy, content_writing_rule, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(tenant, "legacy persona", "shared product", "legacy strategy", "legacy rule", now);
  db.prepare(
    `INSERT INTO review_item
     (id, tenant_id, kind, post_id, post_json, relevant, reason, draft, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("review-1", tenant, "reply", "post-1", "{}", 1, "relevant", "draft", "approved", now);
}

describe("runDefaultAccountMigration", () => {
  it("moves a legacy install into a default active account", async () => {
    const { db, runDefaultAccountMigration } = await loadFreshDatabase();
    seedLegacyInstall(db);

    runDefaultAccountMigration(tenant);

    const account = db.prepare(`SELECT * FROM threads_account WHERE tenant_id = ?`).get(tenant) as Record<string, unknown>;
    expect(account).toMatchObject({
      handle: "default",
      display_name: "Legacy Brand",
      persona: "legacy persona",
      marketing_strategy: "legacy strategy",
      content_writing_rule: "legacy rule",
      deleted_at: null,
    });
    expect(
      db.prepare(`SELECT active_threads_account_id FROM tenant_config WHERE tenant_id = ?`).get(tenant),
    ).toEqual({ active_threads_account_id: account.id });
    expect(db.prepare(`SELECT threads_account_id FROM review_item WHERE id = ?`).get("review-1")).toEqual({
      threads_account_id: account.id,
    });
    expect(
      db
        .prepare(
          `SELECT persona, owned_product, marketing_strategy, content_writing_rule
           FROM agent_def WHERE tenant_id = ?`,
        )
        .get(tenant),
    ).toEqual({
      persona: "",
      owned_product: "shared product",
      marketing_strategy: "",
      content_writing_rule: "",
    });
  });

  it("is a no-op when re-run for an already migrated install", async () => {
    const { db, runDefaultAccountMigration } = await loadFreshDatabase();
    seedLegacyInstall(db);

    runDefaultAccountMigration(tenant);
    const firstAccount = db.prepare(`SELECT * FROM threads_account WHERE tenant_id = ?`).get(tenant);
    expect(() => runDefaultAccountMigration(tenant)).not.toThrow();

    expect(db.prepare(`SELECT COUNT(*) AS count FROM threads_account WHERE tenant_id = ?`).get(tenant)).toEqual({
      count: 1,
    });
    expect(db.prepare(`SELECT * FROM threads_account WHERE tenant_id = ?`).get(tenant)).toEqual(firstAccount);
  });

  it("does not create a phantom account before tenant onboarding", async () => {
    const { db, runDefaultAccountMigration } = await loadFreshDatabase();

    runDefaultAccountMigration(tenant);

    expect(db.prepare(`SELECT COUNT(*) AS count FROM threads_account`).get()).toEqual({ count: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS count FROM tenant_config`).get()).toEqual({ count: 0 });
  });
});
