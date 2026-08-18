/**
 * Last-modified dates for sitemap.xml, derived from content hashes rather
 * than file mtimes (checkpoint commits touch unchanged files, so mtimes lie).
 *
 * Two git-tracked manifests record the sha256 of rendered data and the date
 * that hash was first seen:
 *   - data/sitemap-lastmod.json          — one entry per coarse URL group
 *     ("corpus", "terminology"), used for static pages and terminology
 *     object pages.
 *   - data/sitemap-lastmod-sections.json — one entry per corpus section id,
 *     so each /section/:id and /legomena/reader/:id URL carries its own
 *     lastmod and crawlers can re-fetch only the passages that changed.
 *
 * When the current hash matches the manifest, the recorded date is used;
 * when it does not (data changed but the manifest was not refreshed),
 * today's date is used in-memory so the sitemap stays truthful, and
 * validate-discovery-metadata flags the stale manifest so it gets committed
 * with the new hash.
 *
 * Refresh both manifests with:
 *   pnpm --filter @workspace/scripts run update-sitemap-lastmod
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { corpus, dataDir } from "./corpus";
import { getOtbModel } from "./otb/build";

export type LastmodGroup = "corpus" | "terminology";

export interface LastmodManifest {
  [group: string]: { hash: string; date: string };
}

/** Per-section manifest: section id -> { hash, date }. */
export interface SectionLastmodManifest {
  [sectionId: string]: { hash: string; date: string };
}

export const LASTMOD_MANIFEST_PATH = path.join(
  dataDir,
  "sitemap-lastmod.json",
);

export const SECTION_LASTMOD_MANIFEST_PATH = path.join(
  dataDir,
  "sitemap-lastmod-sections.json",
);

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Current content hash per URL group (stable across runs, mtime-free). */
export function currentGroupHashes(): Record<LastmodGroup, string> {
  return {
    corpus: sha256(JSON.stringify(corpus)),
    terminology: sha256(JSON.stringify(getOtbModel())),
  };
}

/** Current content hash per corpus section id. */
export function currentSectionHashes(): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const s of corpus) {
    hashes[s.id] = sha256(JSON.stringify(s));
  }
  return hashes;
}

export function readLastmodManifest(): LastmodManifest {
  if (!existsSync(LASTMOD_MANIFEST_PATH)) return {};
  return JSON.parse(
    readFileSync(LASTMOD_MANIFEST_PATH, "utf-8"),
  ) as LastmodManifest;
}

export function readSectionLastmodManifest(): SectionLastmodManifest {
  if (!existsSync(SECTION_LASTMOD_MANIFEST_PATH)) return {};
  return JSON.parse(
    readFileSync(SECTION_LASTMOD_MANIFEST_PATH, "utf-8"),
  ) as SectionLastmodManifest;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

let resolved: Record<LastmodGroup, string> | null = null;

/** Effective lastmod date (YYYY-MM-DD) per URL group. */
export function groupLastmodDates(): Record<LastmodGroup, string> {
  if (resolved) return resolved;
  const manifest = readLastmodManifest();
  const hashes = currentGroupHashes();
  const dates = {} as Record<LastmodGroup, string>;
  for (const group of Object.keys(hashes) as LastmodGroup[]) {
    const entry = manifest[group];
    dates[group] =
      entry && entry.hash === hashes[group] ? entry.date : todayIso();
  }
  resolved = dates;
  return dates;
}

let resolvedSections: Map<string, string> | null = null;

/** Effective lastmod date (YYYY-MM-DD) per corpus section id. */
export function sectionLastmodDates(): Map<string, string> {
  if (resolvedSections) return resolvedSections;
  const manifest = readSectionLastmodManifest();
  const hashes = currentSectionHashes();
  const dates = new Map<string, string>();
  for (const [id, hash] of Object.entries(hashes)) {
    const entry = manifest[id];
    dates.set(id, entry && entry.hash === hash ? entry.date : todayIso());
  }
  resolvedSections = dates;
  return dates;
}

/** lastmod for a site-relative path (static pages use the newest group date). */
export function lastmodFor(sitePath: string): string {
  const dates = groupLastmodDates();
  const sectionMatch = sitePath.match(
    /^\/(?:section|legomena\/reader)\/(.+)$/,
  );
  if (sectionMatch) {
    // Unknown ids (should not occur — the sitemap expands from the same
    // corpus) fall back to the corpus-wide date rather than lying.
    return sectionLastmodDates().get(sectionMatch[1] as string) ?? dates.corpus;
  }
  if (sitePath.startsWith("/terminology/objects/")) {
    return dates.terminology;
  }
  // Static routes: content tracks the edition as a whole; use the newest date.
  return Object.values(dates).sort().at(-1) as string;
}
