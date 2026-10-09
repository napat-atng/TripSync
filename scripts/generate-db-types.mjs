import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const result = spawnSync(process.execPath, [resolve("node_modules/supabase/dist/supabase.js"), "gen", "types", "typescript", "--local", "--schema", "tripsync"], {
  encoding: "utf8",
});
if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? result.stderr);
  process.exit(1);
}
mkdirSync(resolve("src/shared"), { recursive: true });
writeFileSync(resolve("src/shared/database.types.ts"), result.stdout, "utf8");
console.log("Generated types from the local tripsync schema.");
