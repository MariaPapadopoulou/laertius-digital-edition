/**
 * Refreshes the sitemap lastmod manifests:
 *   - artifacts/api-server/data/sitemap-lastmod.json (per URL group)
 *   - artifacts/api-server/data/sitemap-lastmod-sections.json (per section id)
 * For each entry whose content hash changed, records the new hash with
 * today's date; unchanged entries keep their existing date, and section
 * entries whose id no longer exists in the corpus are dropped. Run after
 * data changes:
 *   pnpm --filter @workspace/scripts run update-sitemap-lastmod
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const {
  currentGroupHashes,
  readLastmodManifest,
  LASTMOD_MANIFEST_PATH,
  currentSectionHashes,
  readSectionLastmodManifest,
  SECTION_LASTMOD_MANIFEST_PATH,
} = await import("../../artifacts/api-server/src/lib/sitemap-lastmod");

const today = new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------- URL groups
const manifest = readLastmodManifest();
const hashes = currentGroupHashes();
let changed = 0;
for (const [group, hash] of Object.entries(hashes)) {
  const entry = manifest[group];
  if (!entry || entry.hash !== hash) {
    manifest[group] = { hash, date: today };
    changed++;
    console.log(`updated ${group} -> ${today}`);
  } else {
    console.log(`unchanged ${group} (${entry.date})`);
  }
}
writeFileSync(
  LASTMOD_MANIFEST_PATH,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `${LASTMOD_MANIFEST_PATH}: ${changed} group(s) updated, ${Object.keys(hashes).length - changed} unchanged`,
);

// ---------------------------------------------------------------- sections
const oldSections = readSectionLastmodManifest();
const sectionHashes = currentSectionHashes();
const newSections: typeof oldSections = {};
let sectionChanged = 0;
let sectionDropped = 0;
for (const [id, hash] of Object.entries(sectionHashes)) {
  const entry = oldSections[id];
  if (entry && entry.hash === hash) {
    newSections[id] = entry;
  } else {
    newSections[id] = { hash, date: today };
    sectionChanged++;
  }
}
for (const id of Object.keys(oldSections)) {
  if (!(id in sectionHashes)) sectionDropped++;
}
writeFileSync(
  SECTION_LASTMOD_MANIFEST_PATH,
  JSON.stringify(newSections, null, 2) + "\n",
);
console.log(
  `${SECTION_LASTMOD_MANIFEST_PATH}: ${sectionChanged} section(s) updated, ${Object.keys(sectionHashes).length - sectionChanged} unchanged, ${sectionDropped} dropped`,
);

export {};
