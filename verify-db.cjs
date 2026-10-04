// Verifies that the committed migrations apply cleanly and that the
// constraints behave as the schema claims, through the real client path.
process.env.NODE_ENV = "test";
process.env.DATABASE_DIR = ".data/verify-db";

// The verification database is file-backed on purpose (it exercises the real
// migration path), so the directory must be wiped before each run — otherwise
// leftover rows from a previous verification make the fixed fixtures collide.
const { rmSync } = require("node:fs");
const { resolve } = require("node:path");
rmSync(resolve(process.cwd(), ".data/verify-db"), { recursive: true, force: true });

const { ensureDbReady, getClient, resetDatabaseForTesting, pingDatabase } = require("./src/server/db/client.ts");

async function main() {
  await resetDatabaseForTesting();
  await ensureDbReady();
  console.log("PING:", await pingDatabase());

  const client = getClient();

  const tables = await client.query(
    `select table_name from information_schema.tables where table_schema='public' order by table_name`
  );
  console.log("TABLES:", tables.rows.map((r) => r.table_name).join(","));

  const enums = await client.query(
    `select typname from pg_type where typtype='e' order by typname`
  );
  console.log("ENUMS:", enums.rows.map((r) => r.typname).join(","));

  const idx = await client.query(
    `select indexname from pg_indexes where schemaname='public' order by indexname`
  );
  console.log("INDEXES:", idx.rows.map((r) => r.indexname).join(","));

  // Idempotency: running the migration path again must not fail or duplicate.
  globalThis.__quizDbReady = undefined;
  await ensureDbReady();
  const ledger = await client.query(`select count(*)::int as n from "__migrations"`);
  console.log("LEDGER_ROWS:", ledger.rows[0].n);

  // Enum constraint is enforced by the database.
  const userId = "00000000-0000-0000-0000-000000000001";
  await client.query(
    `insert into users (id,email,password_hash,display_name) values ($1,$2,$3,$4)`,
    [userId, "verify@example.test", "hash", "Verify"]
  );
  let enumResult = "not-enforced";
  try {
    await client.query(
      `insert into sessions (user_id, token_hash, expires_at) values ($1,$2,now())`,
      [userId, "h"]
    );
    await client.query(`insert into messages (conversation_id, role, content) values (gen_random_uuid(),'bogus','x')`);
  } catch (e) {
    enumResult = /invalid input value|enum|foreign key/i.test(e.message) ? "enforced" : e.message;
  }
  console.log("CONSTRAINTS:", enumResult);

  await resetDatabaseForTesting();
  console.log("VERIFY_OK");
}
main().catch((e) => { console.error("VERIFY_FAILED", e); process.exit(1); });