// Generates src/server/db/migrations.ts from the drizzle/*.sql migration files.
//
// The SQL files produced by drizzle-kit stay the single source of truth. This
// script only converts them into an importable TypeScript module so the same
// statements can be applied by the embedded development database.
//
// Run after every `npm run db:generate`:  node scripts/generate-migrations.mjs

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const drizzleDir = join(root, "drizzle");
const outFile = join(root, "src", "server", "db", "migrations.ts");
const BREAKPOINT = "--> statement-breakpoint";

const files = readdirSync(drizzleDir)
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.error("No .sql migrations found in drizzle/. Run `npm run db:generate` first.");
  process.exit(1);
}

const migrations = files.map((file) => {
  const raw = readFileSync(join(drizzleDir, file), "utf8");
  const statements = raw
    .split(BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && statement !== ";");
  return { name: file.replace(/\.sql$/, ""), statements };
});

const total = migrations.reduce((sum, migration) => sum + migration.statements.length, 0);

const banner = `// AUTO-GENERATED — do not edit by hand.
// Source: drizzle/*.sql. Regenerate with: node scripts/generate-migrations.mjs
//
// Applied by src/server/db/client.ts through a ledger table so each migration
// runs exactly once per database, mirroring how a real PostgreSQL deployment
// applies the same files.`;

const body = migrations
  .map(
    (migration) =>
      `  {\n    name: ${JSON.stringify(migration.name)},\n    statements: [\n${migration.statements
        .map((statement) => `      ${JSON.stringify(statement)},`)
        .join("\n")}\n    ],\n  },`
  )
  .join("\n");

const content = `${banner}

export type Migration = {
  name: string;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
${body}
];

/** Ledger table recording which migrations a database has already applied. */
export const MIGRATION_LEDGER_TABLE = "__migrations";
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, content, "utf8");

console.log(
  `Wrote ${outFile}\n  migrations: ${migrations.length}\n  statements: ${total}`
);