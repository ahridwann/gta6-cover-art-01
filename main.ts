// Porto Solmar Cover Studio — entrypoint.
// Hands the entry in: copies app/ and screenshots/ from this repository
// into the output directory and writes /output/dossier.json with
// buildDossier from the kit's vendor/makefun-app.ts.
// Standard library only; run with: node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || "/output");

const appDir = join(repoRoot, "app");
const shotsDir = join(repoRoot, "screenshots");

if (!existsSync(appDir)) {
  throw new Error(`main.ts: no app/ directory in ${repoRoot}`);
}
if (!existsSync(shotsDir)) {
  throw new Error("main.ts: no screenshots/ directory — add 3 or 4 renders of the app first");
}

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "app"), { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });

cpSync(appDir, join(outDir, "app"), { recursive: true });
cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

writeFileSync(join(outDir, "dossier.json"), dossier);
console.log(`Porto Solmar Cover Studio handed in to ${outDir}`);
console.log(`dossier.json: ${dossier.length} bytes`);
