/**
 * Check that exports/laertius-ionos.zip is not older than the latest content
 * sources. The live IONOS site only updates when the zip is rebuilt and
 * uploaded, so a stale zip silently serves outdated content.
 *
 * The actual check lives in ionos-bundle-contract.ts (checkBundleFreshness),
 * shared with e2e-ionos-legomena.ts so the browser e2e fails fast on a stale
 * zip instead of booting servers and Chromium against outdated code.
 *
 * Compared against the zip's mtime (content hashes from the sources manifest
 * break ties for checkpoint-touched files):
 *   - the bundled data files in artifacts/api-server/data/ and
 *     artifacts/legomena-api/data/
 *   - every source file under artifacts/api-server/src/,
 *     artifacts/laertius/src/, and artifacts/legomena-api/src/
 *   - the bundle templates in exports/ionos-bundle/
 *   - the build-shaping files from ionos-bundle-contract.ts (package.json
 *     manifests, esbuild configs with their externals lists, Vite config)
 *
 * Exit codes:
 *   0 — zip exists and is newer than all content sources
 *   1 — zip missing, or at least one content source is newer than the zip
 *
 * Run: pnpm --filter @workspace/scripts run check-bundle-freshness
 * Rebuild when stale: pnpm --filter @workspace/scripts run build-ionos-bundle
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkBundleFreshness } from "./ionos-bundle-contract";

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const zipPath = path.join(repoRoot, "exports", "laertius-ionos.zip");

const { error, notes } = checkBundleFreshness(repoRoot, zipPath);
for (const note of notes) console.log(note);
if (error) {
  console.error(error);
  process.exit(1);
}
