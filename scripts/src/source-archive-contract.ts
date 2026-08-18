/**
 * Shared contract for the full-source archive: which workspace files belong
 * in exports/laertius-full-source.zip. Used by build-source-archive.ts (to
 * build it) and check-source-archive-freshness.ts (to detect a stale zip),
 * so the two can never drift on the selection rules.
 */
import { execFileSync } from "node:child_process";

export const EXCLUDE = [
  /^exports\//, // generated deliverables, incl. this zip itself
  /(^|\/)verification\//, // QA screenshots + audit reports at any depth, not source
  /(^|\/)\.env(\.|$)/, // env/secret files at any depth
  /(^|\/)nohup\.out$/,
  /\.log$/,
  /\.zip$/,
];

export const PROBE_FILES = [
  "artifacts/api-server/package.json",
  "artifacts/laertius/package.json",
  // The Legomena web app's source lives inside artifacts/laertius
  // (artifacts/legomena is only its built preview bundle); its API
  // package is legomena-api.
  "artifacts/legomena-api/package.json",
  "artifacts/laertius/src/pages/legomena/reader.tsx",
  "artifacts/mockup-sandbox/package.json",
  "scripts/package.json",
  "pnpm-workspace.yaml",
  "package.json",
];

/**
 * Everything git considers source: tracked + untracked-not-ignored, minus
 * the EXCLUDE patterns. -z keeps raw (unquoted) names; none of our paths
 * contain newlines.
 */
export function listSourceFiles(root: string): string[] {
  const raw = execFileSync("git", ["ls-files", "-coz", "--exclude-standard"], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8");
  const all = raw.split("\0").filter(Boolean);
  return all.filter((f) => !EXCLUDE.some((re) => re.test(f)));
}
