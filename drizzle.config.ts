import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * `generate` produces real PostgreSQL migration SQL into ./drizzle. Those files
 * are the source of truth for the schema and are what a hosted PostgreSQL
 * deployment applies. The embedded development database (PGlite) executes the
 * same statements, so both paths stay identical.
 *
 * Commands:
 *   npm run db:generate   create a migration from schema.ts changes
 *   npm run db:check      verify schema and migrations agree
 *   npm run db:studio     inspect data (requires a running server)
 */
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
});