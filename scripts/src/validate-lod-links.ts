/**
 * Fast source-level check that the LOD download links rendered by the Graph,
 * Section, and Stats pages and the KG model diagram component (About page)
 * are still present. The IONOS bundle smoke test
 * (smoke-ionos-bundle.ts) checks the same fragments in the built JS, but that
 * requires a full multi-minute bundle build; this validator catches a dropped
 * link seconds after an edit, the way the other curated-layer validators do.
 *
 * Both checks read one shared fragment list (lod-link-fragments.ts) so they
 * cannot drift.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-lod-links
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { REQUIRED_LOD_LINK_FRAGMENTS } from "./lod-link-fragments";

const srcDir = path.resolve(
  import.meta.dirname,
  "../../artifacts/laertius/src",
);

const pages = [...new Set(REQUIRED_LOD_LINK_FRAGMENTS.map((f) => f.page))];
const sources = new Map<string, string>();
for (const page of pages) {
  sources.set(page, readFileSync(path.join(srcDir, page), "utf8"));
}

const errors: string[] = [];
for (const { fragment, page } of REQUIRED_LOD_LINK_FRAGMENTS) {
  const source = sources.get(page);
  if (source === undefined || !source.includes(fragment)) {
    errors.push(
      `${page} is missing the LOD download link fragment "${fragment}"`,
    );
  }
}

if (errors.length > 0) {
  console.error(
    `validate-lod-links FAILED (${errors.length} problem${errors.length === 1 ? "" : "s"}): a download panel edit dropped a link`,
  );
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(
  `✓ all ${REQUIRED_LOD_LINK_FRAGMENTS.length} pinned LOD download link fragments present across ${pages.length} page sources (${pages.join(", ")})`,
);
