// Deletes the local embedded development database so migrations can be
// re-applied from scratch. Never touches a remote database.

import { rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.cwd(), process.argv[2] ?? ".data/pglite");

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

if (!exists(target)) {
  console.log(`Nothing to remove at ${target}`);
  process.exit(0);
}

// Refuse to delete anything that is not clearly the local data directory, so a
// mistyped path can never remove project or system files.
const normalised = target.replace(/\\/g, "/");
if (!normalised.includes("/.data/") && !normalised.endsWith("/.data")) {
  console.error(
    `Refusing to delete ${target}: it is not inside a .data directory.\n` +
      "Pass the database directory explicitly if this is intentional."
  );
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
console.log(`Removed ${target}`);
console.log("Run `npm run dev` to recreate and migrate the database.");