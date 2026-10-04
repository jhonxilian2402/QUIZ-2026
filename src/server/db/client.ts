import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { getEnv } from "../config/env";
import { logger } from "../logger";
import * as schema from "./schema";

/**
 * Database client.
 *
 * The application talks to PostgreSQL through Drizzle. In this environment the
 * Postgres engine runs embedded via PGlite (real Postgres compiled to WASM,
 * file-backed), so there is no server to install while the schema, SQL, enums
 * and constraints remain genuine PostgreSQL. Pointing at a hosted Postgres
 * later means swapping this client for node-postgres; nothing above it changes.
 *
 * The instance is cached on globalThis so Next.js hot reloads and repeated
 * module evaluation do not open additional databases or connections.
 */

export type Database = PgliteDatabase<typeof schema>;

type GlobalWithDb = typeof globalThis & {
  __quizPglite?: PGlite;
  __quizDb?: Database;
  __quizDbReady?: Promise<void>;
};

const globalForDb = globalThis as GlobalWithDb;

function createClient(): PGlite {
  const env = getEnv();
  const configured = env.databaseLocation;

  // In-memory mode is requested with the `memory://` URL used by tests. PGlite
  // creates an in-memory instance when given no path at all, so this must not be
  // resolved into a filesystem directory.
  if (configured.startsWith("memory:")) {
    return new PGlite();
  }

  const location = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);

  // PGlite creates the database directory but not its parents.
  mkdirSync(dirname(location), { recursive: true });

  return new PGlite(location);
}

export function getClient(): PGlite {
  if (!globalForDb.__quizPglite) {
    globalForDb.__quizPglite = createClient();
  }
  return globalForDb.__quizPglite;
}

export function getDb(): Database {
  if (!globalForDb.__quizDb) {
    globalForDb.__quizDb = drizzle(getClient(), { schema });
  }
  return globalForDb.__quizDb;
}

/**
 * Applies committed migrations exactly once per database.
 *
 * A ledger table records which migrations have already run, so startup is
 * idempotent and reproducible: the same drizzle/*.sql files a real PostgreSQL
 * deployment applies are executed here in filename order.
 */
async function applyMigrations(): Promise<void> {
  const client = getClient();

  const { MIGRATIONS, MIGRATION_LEDGER_TABLE } = await import("./migrations");

  await client.exec(
    `CREATE TABLE IF NOT EXISTS "${MIGRATION_LEDGER_TABLE}" (
       name text PRIMARY KEY,
       applied_at timestamp with time zone NOT NULL DEFAULT now()
     );`
  );

  const appliedRows = await client.query<{ name: string }>(
    `SELECT name FROM "${MIGRATION_LEDGER_TABLE}"`
  );
  const applied = new Set(appliedRows.rows.map((row) => row.name));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;

    // Each migration is atomic: a partially applied schema is never left behind.
    await client.exec("BEGIN");
    try {
      for (const statement of migration.statements) {
        await client.exec(statement);
      }
      await client.query(
        `INSERT INTO "${MIGRATION_LEDGER_TABLE}" (name) VALUES ($1)`,
        [migration.name]
      );
      await client.exec("COMMIT");
    } catch (error) {
      await client.exec("ROLLBACK");
      throw new Error(
        `Migration "${migration.name}" failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error }
      );
    }
  }
}

/** Ensures the schema exists. Safe to await on every request; runs once. */
export function ensureDbReady(): Promise<void> {
  if (!globalForDb.__quizDbReady) {
    globalForDb.__quizDbReady = applyMigrations().catch((error) => {
      globalForDb.__quizDbReady = undefined;
      throw error;
    });
  }
  return globalForDb.__quizDbReady;
}

/** Cheap liveness probe for the health endpoint. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await ensureDbReady();
    await getDb().execute(sql`select 1`);
    return true;
  } catch (error) {
    // Logged at debug level because the health endpoint reports the outcome to
    // the caller without exposing infrastructure detail.
    logger.debug("Database ping failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Runs a unit of work inside a transaction. Used wherever several writes must
 * all succeed or all fail (creating a quiz with its questions, completing an
 * attempt with its answers).
 */
export async function withTransaction<T>(
  work: (tx: Database) => Promise<T>
): Promise<T> {
  await ensureDbReady();
  const db = getDb();
  return db.transaction(async (tx) => work(tx as unknown as Database));
}

/** Test helper: closes and forgets the connection between suites. */
export async function resetDatabaseForTesting(): Promise<void> {
  if (globalForDb.__quizPglite) {
    await globalForDb.__quizPglite.close();
  }
  globalForDb.__quizPglite = undefined;
  globalForDb.__quizDb = undefined;
  globalForDb.__quizDbReady = undefined;
}