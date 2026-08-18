/**
 * Annotation coverage audit: is everything that should be annotated
 * indeed annotated?
 *
 * The tagger (gazetteer.ts + annotate.ts) is precision-first: ambiguous
 * surfaces are skipped, homonyms are section-scoped, Greek matching is
 * deliberately conservative. This audit measures the other side of that
 * bargain - RECALL - and classifies every untagged occurrence of a name
 * the graph knows about:
 *
 *  EN-1  occurrences of resolved gazetteer surfaces that end up
 *        untagged: in-scope ones are UNEXPECTED (tagger bug), scoped-out
 *        ones are the documented homonym splits;
 *  EN-2  occurrences of ledger surfaces (ambiguous / text-ambiguous /
 *        blocklisted) - documented untagged, counted so the size of the
 *        deliberate gap is visible;
 *  EN-3  entities with NO surface at all whose rdfs:label nevertheless
 *        occurs in the English text - either the double-node convention
 *        (label claimed by another bearer), a filtered work title, or a
 *        REAL coverage gap;
 *  GRC-1 capitalized Greek tokens equal to a known declined form but
 *        untagged: in-scope UNEXPECTED vs scoped-out (documented);
 *  GRC-2 tokens equal to ledger forms (skipped / ambiguous outside the
 *        owner's Life) - documented untagged;
 *  GRC-3 entities tagged in English but with zero Greek name coverage
 *        and no entry in the GREEK_NAME_SKIPS ledger - candidates for
 *        Greek curation (works are counted separately: Greek titles are
 *        opt-in by design);
 *  DEAD  gazetteer surfaces that never match anywhere (dead weight),
 *        and scoped entries whose own scope sections lack the surface
 *        (curation slip).
 *
 * Greek TERM inflections are NOT audited: the endings whitelist is
 * documented as deliberately conservative (misses obliques rather than
 * inventing occurrences).
 *
 * Prints a capped human report; writes the full detail to
 * exports/annotation-coverage-audit.json. Always exits 0 - this is an
 * audit, not a validator.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts exec tsx src/audit-annotation-coverage.ts
 */
import path from "node:path";
import { writeFileSync } from "node:fs";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getGazetteer } = await import(
  "../../artifacts/api-server/src/lib/gazetteer"
);
const { annotateSection, normalizedWithMap } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { corpus } = await import("../../artifacts/api-server/src/lib/corpus");
const { GREEK_NAME_SKIPS } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);

import type { GazetteerEntry, GreekNameEntry } from "../../artifacts/api-server/src/lib/gazetteer";

// ------------------------------------------------------------ helpers
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Interval {
  start: number;
  end: number;
}

function covered(ivs: Interval[], start: number, end: number): boolean {
  for (const iv of ivs) {
    if (iv.start < end && iv.end > start) return true;
  }
  return false;
}

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function addSection(map: Map<string, Set<string>>, key: string, id: string) {
  const set = map.get(key) ?? new Set<string>();
  set.add(id);
  map.set(key, set);
}

const g = getGazetteer();

const rawSkips: unknown = GREEK_NAME_SKIPS as unknown;
const greekSkipLabels = new Set<string>(
  Array.isArray(rawSkips)
    ? rawSkips.map(String)
    : rawSkips instanceof Map
      ? [...rawSkips.keys()].map(String)
      : rawSkips instanceof Set
        ? [...rawSkips].map(String)
        : typeof rawSkips === "object" && rawSkips !== null
          ? Object.keys(rawSkips)
          : [],
);

// -------------------------------------------- annotation interval maps
const enAnn = new Map<string, Interval[]>();
const grcAnn = new Map<string, Interval[]>();
const enTaggedUris = new Map<string, number>();
const grcNameTaggedUris = new Map<string, number>();
const enTaggedBySection = new Map<string, Set<string>>();
const grcTaggedBySection = new Map<string, Set<string>>();

for (const s of corpus) {
  const anns = annotateSection(s);
  const en: Interval[] = [];
  const grc: Interval[] = [];
  const enSet = new Set<string>();
  const grcSet = new Set<string>();
  for (const a of anns) {
    if (a.lang === "en") {
      en.push({ start: a.start, end: a.end });
      bump(enTaggedUris, a.entityUri);
      enSet.add(a.entityUri);
    } else {
      grc.push({ start: a.start, end: a.end });
      if (a.kind !== "term") bump(grcNameTaggedUris, a.entityUri);
      grcSet.add(a.entityUri);
    }
  }
  enAnn.set(s.id, en);
  grcAnn.set(s.id, grc);
  enTaggedBySection.set(s.id, enSet);
  grcTaggedBySection.set(s.id, grcSet);
}

// --------------------------------------- EN passes 1+2: known surfaces
type EnReason = "entry" | "skipped" | "ambiguous";
const surfaceInfo = new Map<
  string,
  { reason: EnReason; entries?: GazetteerEntry[]; skipReason?: string }
>();
const entryBySurface = new Map<string, GazetteerEntry[]>();
for (const e of g.entries) {
  const bucket = entryBySurface.get(e.surface) ?? [];
  bucket.push(e);
  entryBySurface.set(e.surface, bucket);
}
for (const [surface, entries] of entryBySurface) {
  surfaceInfo.set(surface, { reason: "entry", entries });
}
for (const sk of g.skipped) {
  if (!surfaceInfo.has(sk.surface)) {
    surfaceInfo.set(sk.surface, { reason: "skipped", skipReason: sk.reason });
  }
}
for (const name of g.ambiguousPhilosopherNames.keys()) {
  if (!surfaceInfo.has(name)) {
    surfaceInfo.set(name, { reason: "ambiguous" });
  }
}

const enAlternation = [...surfaceInfo.keys()]
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join("|");
const enRegex = new RegExp(`(?<!\\p{L})(?:${enAlternation})(?!\\p{L})`, "gu");

const enUnexpected: {
  surface: string;
  sectionId: string;
  start: number;
}[] = [];
const enScopedOut = new Map<string, number>();
const enScopedOutSections = new Map<string, Set<string>>();
const enLedgerOcc = new Map<string, number>();
const enLedgerSections = new Map<string, Set<string>>();
const enLedgerReason = new Map<string, string>();
const matchedSurfaces = new Set<string>();
let enMatchesChecked = 0;
let enMatchesCovered = 0;

for (const s of corpus) {
  const text = s.textEn;
  if (!text) continue;
  const ivs = enAnn.get(s.id)!;
  enRegex.lastIndex = 0;
  for (const m of text.matchAll(enRegex)) {
    const surface = m[0];
    const info = surfaceInfo.get(surface);
    if (!info) continue;
    enMatchesChecked += 1;
    if (info.reason === "entry") matchedSurfaces.add(surface);
    const isCovered = covered(ivs, m.index, m.index + surface.length);
    if (isCovered) {
      enMatchesCovered += 1;
      continue;
    }
    if (info.reason === "entry") {
      const inScope = info.entries!.some(
        (e) => !e.onlySections || e.onlySections.includes(s.id),
      );
      if (inScope) {
        enUnexpected.push({ surface, sectionId: s.id, start: m.index });
      } else {
        bump(enScopedOut, surface);
        addSection(enScopedOutSections, surface, s.id);
      }
    } else {
      bump(enLedgerOcc, surface);
      addSection(enLedgerSections, surface, s.id);
      enLedgerReason.set(
        surface,
        info.reason === "ambiguous"
          ? "ambiguous (heuristic-eligible)"
          : `ledger: ${info.skipReason}`,
      );
    }
  }
}

// ------------------------------- EN pass 3: zero-surface entity labels
const surfacedUris = new Set<string>();
for (const e of g.entries) surfacedUris.add(e.entityUri);
for (const e of g.greekEntries) surfacedUris.add(e.entityUri);

const zeroSurface: { uri: string; label: string; kind: string }[] = [];
for (const [uri, kind] of g.kindByUri) {
  if (surfacedUris.has(uri)) continue;
  const label = g.labelByUri.get(uri);
  if (!label || label.trim().length < 3) continue;
  zeroSurface.push({ uri, label, kind });
}

const zeroBySurfaceText = new Map<string, { uri: string; kind: string }[]>();
for (const z of zeroSurface) {
  const bucket = zeroBySurfaceText.get(z.label) ?? [];
  bucket.push({ uri: z.uri, kind: z.kind });
  zeroBySurfaceText.set(z.label, bucket);
}

const zeroGapOcc = new Map<string, number>();
const zeroGapSections = new Map<string, Set<string>>();
const zeroClaimedOcc = new Map<string, number>();
const zeroShadowedOcc = new Map<string, number>();

if (zeroBySurfaceText.size > 0) {
  const zAlternation = [...zeroBySurfaceText.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const zRegex = new RegExp(`(?<!\\p{L})(?:${zAlternation})(?!\\p{L})`, "gu");
  for (const s of corpus) {
    const text = s.textEn;
    if (!text) continue;
    const ivs = enAnn.get(s.id)!;
    zRegex.lastIndex = 0;
    for (const m of text.matchAll(zRegex)) {
      const label = m[0];
      if (covered(ivs, m.index, m.index + label.length)) {
        // Span already carries a tag: with entry surfaces handled in
        // pass 1, this is the double-node convention (another bearer
        // owns the span) or an overlapping longer surface.
        bump(zeroClaimedOcc, label);
        continue;
      }
      if (surfaceInfo.has(label)) {
        // The same name is a pass-1 surface (resolved, scoped, or on an
        // ambiguity ledger). Its untagged occurrences are already
        // accounted for there; from this entity's perspective it is the
        // documented double-node / shared-name convention, not a new gap.
        bump(zeroShadowedOcc, label);
        continue;
      }
      bump(zeroGapOcc, label);
      addSection(zeroGapSections, label, s.id);
    }
  }
}

// ------------------------------------------------- GRC passes 1 and 2
const grcFormMap = new Map<string, GreekNameEntry[]>();
for (const e of g.greekEntries) {
  if (e.words.length !== 1) continue;
  const bucket = grcFormMap.get(e.form) ?? [];
  bucket.push(e);
  grcFormMap.set(e.form, bucket);
}
const grcSkippedForms = new Map<string, string>();
for (const sk of g.greekSkipped) grcSkippedForms.set(sk.surface, sk.reason);

const grcUnexpected: {
  form: string;
  sectionId: string;
  surface: string;
}[] = [];
const grcScopedOut = new Map<string, number>();
const grcScopedOutSections = new Map<string, Set<string>>();
const grcLedgerOcc = new Map<string, number>();
const grcLedgerReason = new Map<string, string>();
const grcLedgerSections = new Map<string, Set<string>>();
let grcTokensChecked = 0;
let grcTokensCovered = 0;

for (const s of corpus) {
  const { norm, map, mapEnd } = normalizedWithMap(s.text);
  const ivs = grcAnn.get(s.id)!;
  for (const m of norm.matchAll(/\p{L}+/gu)) {
    const token = m[0];
    const isKnown =
      grcFormMap.has(token) ||
      grcSkippedForms.has(token) ||
      g.ambiguousGreekPhilosopherForms.has(token);
    if (!isKnown) continue;
    const origStart = map[m.index]!;
    const origEnd = mapEnd[m.index + token.length - 1]!;
    const cp = s.text.codePointAt(origStart);
    const capitalized =
      cp !== undefined && /\p{Lu}/u.test(String.fromCodePoint(cp));
    if (!capitalized) continue; // production requires capitals; lowercase is out of contract
    grcTokensChecked += 1;
    if (covered(ivs, origStart, origEnd)) {
      grcTokensCovered += 1;
      continue;
    }
    const entries = grcFormMap.get(token);
    if (entries) {
      const inScope = entries.some(
        (e) => !e.onlySections || e.onlySections.includes(s.id),
      );
      if (inScope) {
        grcUnexpected.push({
          form: token,
          sectionId: s.id,
          surface: s.text.slice(origStart, origEnd),
        });
      } else {
        bump(grcScopedOut, token);
        addSection(grcScopedOutSections, token, s.id);
      }
      continue;
    }
    if (grcSkippedForms.has(token)) {
      bump(grcLedgerOcc, token);
      grcLedgerReason.set(token, `ledger: ${grcSkippedForms.get(token)!}`);
      addSection(grcLedgerSections, token, s.id);
    } else {
      bump(grcLedgerOcc, token);
      grcLedgerReason.set(token, "ambiguous outside owner Life");
      addSection(grcLedgerSections, token, s.id);
    }
  }
}

// -------------------------------- GRC pass 3: EN-tagged, no Greek side
const noGreek: { label: string; kind: string; enOcc: number }[] = [];
let noGreekWorks = 0;
for (const [uri, n] of enTaggedUris) {
  if (grcNameTaggedUris.has(uri)) continue;
  const label = g.labelByUri.get(uri);
  const kind = g.kindByUri.get(uri);
  if (!label || !kind) continue; // terms and non-entity nodes
  if (greekSkipLabels.has(label)) continue; // documented skip
  if (kind === "work") {
    noGreekWorks += 1;
    continue; // Greek titles are curated opt-in by design
  }
  noGreek.push({ label, kind, enOcc: n });
}
noGreek.sort((a, b) => b.enOcc - a.enOcc);

// --------------------------------------------------- DEAD surface pass
const deadSurfaces: string[] = [];
for (const surface of entryBySurface.keys()) {
  if (!matchedSurfaces.has(surface)) deadSurfaces.push(surface);
}
deadSurfaces.sort();

// Entities that HAVE surfaces or Greek forms but received zero tags in
// both languages - e.g. a label spelled differently in Hicks' prose than
// in the curated registry. These are invisible to the zero-surface pass
// and are prime real-gap candidates.
const uriSurfaces = new Map<string, Set<string>>();
for (const e of g.entries) {
  const set = uriSurfaces.get(e.entityUri) ?? new Set<string>();
  set.add(e.surface);
  uriSurfaces.set(e.entityUri, set);
}
for (const e of g.greekEntries) {
  const set = uriSurfaces.get(e.entityUri) ?? new Set<string>();
  set.add(`grc:${e.grc}`);
  uriSurfaces.set(e.entityUri, set);
}
const zeroTagged: { label: string; kind: string; surfaces: string[] }[] = [];
for (const [uri, surfs] of uriSurfaces) {
  if (enTaggedUris.has(uri) || grcNameTaggedUris.has(uri)) continue;
  zeroTagged.push({
    label: g.labelByUri.get(uri) ?? uri,
    kind: g.kindByUri.get(uri) ?? "?",
    surfaces: [...surfs],
  });
}
zeroTagged.sort((a, b) => a.label.localeCompare(b.label));

// A scoped ENTITY is slipping only if one of its claimed scope sections
// tags it in NEITHER language (individual surfaces need not occur in
// every scope section - the bare-name or Greek entry may cover it).
const scopedByUri = new Map<string, Set<string>>();
for (const e of g.entries) {
  if (!e.onlySections) continue;
  const set = scopedByUri.get(e.entityUri) ?? new Set<string>();
  for (const id of e.onlySections) set.add(id);
  scopedByUri.set(e.entityUri, set);
}
for (const e of g.greekEntries) {
  if (!e.onlySections) continue;
  const set = scopedByUri.get(e.entityUri) ?? new Set<string>();
  for (const id of e.onlySections) set.add(id);
  scopedByUri.set(e.entityUri, set);
}
const scopeSlips: { label: string; uri: string; missingSections: string[] }[] = [];
for (const [uri, secs] of scopedByUri) {
  const missing = [...secs].filter(
    (id) =>
      !(enTaggedBySection.get(id)?.has(uri) ?? false) &&
      !(grcTaggedBySection.get(id)?.has(uri) ?? false),
  );
  if (missing.length > 0) {
    scopeSlips.push({
      label: g.labelByUri.get(uri) ?? uri,
      uri,
      missingSections: missing,
    });
  }
}

// -------------------------------------------------------------- report
const fmtSections = (set: Set<string> | undefined, cap = 6): string =>
  set ? [...set].slice(0, cap).join(" ") + (set.size > cap ? ` (+${set.size - cap})` : "") : "";

function printCounted(
  title: string,
  occ: Map<string, number>,
  reason: Map<string, string> | null,
  sections: Map<string, Set<string>>,
  cap = 40,
): void {
  const rows = [...occ.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, [, c]) => n + c, 0);
  console.log(`\n${title}: ${rows.length} distinct, ${total} occurrences`);
  for (const [key, count] of rows.slice(0, cap)) {
    const r = reason?.get(key);
    console.log(
      `  ${key}  x${count}${r ? `  [${r}]` : ""}  @ ${fmtSections(sections.get(key))}`,
    );
  }
  if (rows.length > cap) console.log(`  ... ${rows.length - cap} more (see JSON)`);
}

console.log("=== Annotation coverage audit ===");
console.log(
  `corpus: ${corpus.length} sections (${corpus.filter((s) => s.textEn).length} with English)`,
);
console.log(
  `checked: ${enMatchesChecked} English surface matches (${enMatchesCovered} covered), ` +
    `${grcTokensChecked} Greek capitalized known tokens (${grcTokensCovered} covered)`,
);
console.log(
  `gazetteer: ${g.entries.length} entries, ${g.greekEntries.length} Greek forms, ` +
    `${g.skipped.length} skipped surfaces, ${g.greekSkipped.length} skipped Greek forms`,
);

console.log(`\n--- UNEXPECTED (should be zero) ---`);
console.log(`EN in-scope surface matches with no tag: ${enUnexpected.length}`);
for (const u of enUnexpected.slice(0, 40)) {
  console.log(`  ${u.surface} @ ${u.sectionId}:${u.start}`);
}
console.log(`GRC in-scope form tokens with no tag: ${grcUnexpected.length}`);
for (const u of grcUnexpected.slice(0, 40)) {
  console.log(`  ${u.form} (${u.surface}) @ ${u.sectionId}`);
}
console.log(
  `Scoped entities untagged (both languages) in a claimed scope section: ${scopeSlips.length}`,
);
for (const s of scopeSlips.slice(0, 30)) {
  console.log(`  ${s.label}: ${s.missingSections.join(" ")}`);
}

console.log(`\n--- REAL GAP CANDIDATES ---`);
printCounted(
  "EN-3 zero-surface entity labels occurring UNCOVERED in the text",
  zeroGapOcc,
  null,
  zeroGapSections,
);
console.log(
  `\nGRC-3 entities tagged in English, zero Greek name tags, not in the skip ledger: ${noGreek.length}` +
    ` (plus ${noGreekWorks} works, Greek titles opt-in by design)`,
);
for (const e of noGreek.slice(0, 60)) {
  console.log(`  ${e.label} [${e.kind}] en x${e.enOcc}`);
}
if (noGreek.length > 60) console.log(`  ... ${noGreek.length - 60} more (see JSON)`);

console.log(`\n--- DOCUMENTED / DELIBERATE ---`);
printCounted("EN-2 ledger surfaces untagged", enLedgerOcc, enLedgerReason, enLedgerSections, 25);
printCounted("EN-1 scoped-out homonym occurrences", enScopedOut, null, enScopedOutSections, 25);
printCounted("GRC scoped-out form occurrences", grcScopedOut, null, grcScopedOutSections, 25);
printCounted("GRC-2 ledger forms untagged", grcLedgerOcc, grcLedgerReason, grcLedgerSections, 25);
console.log(
  `\nzero-surface labels claimed by another bearer's tag (double-node convention): ${zeroClaimedOcc.size}` +
    `; shadowed by a ledgered/scoped surface of the same name: ${zeroShadowedOcc.size}`,
);
console.log(`\nDEAD: entry surfaces matching nowhere: ${deadSurfaces.length}`);
for (const d of deadSurfaces.slice(0, 30)) console.log(`  ${d}`);
console.log(
  `\nZERO-TAGGED entities (have surfaces/forms, tag nothing in either language): ${zeroTagged.length}`,
);
for (const z of zeroTagged.slice(0, 40)) {
  console.log(`  ${z.label} [${z.kind}]  surfaces: ${z.surfaces.join(" | ")}`);
}

const jsonOut = {
  generatedAt: new Date().toISOString(),
  summary: {
    sections: corpus.length,
    enMatchesChecked,
    enMatchesCovered,
    grcTokensChecked,
    grcTokensCovered,
    enUnexpected: enUnexpected.length,
    grcUnexpected: grcUnexpected.length,
    scopeSlips: scopeSlips.length,
    zeroSurfaceGapLabels: zeroGapOcc.size,
    noGreekEntities: noGreek.length,
    noGreekWorks,
    deadSurfaces: deadSurfaces.length,
    zeroTaggedEntities: zeroTagged.length,
  },
  zeroTagged,
  enUnexpected,
  grcUnexpected,
  scopeSlips,
  zeroSurfaceGaps: [...zeroGapOcc.entries()].map(([label, count]) => ({
    label,
    count,
    kinds: zeroBySurfaceText.get(label)?.map((z) => z.kind) ?? [],
    sections: [...(zeroGapSections.get(label) ?? [])],
  })),
  zeroSurfaceClaimed: [...zeroClaimedOcc.entries()].map(([label, count]) => ({ label, count })),
  zeroSurfaceShadowed: [...zeroShadowedOcc.entries()].map(([label, count]) => ({ label, count })),
  noGreek,
  enLedger: [...enLedgerOcc.entries()].map(([surface, count]) => ({
    surface,
    count,
    reason: enLedgerReason.get(surface),
    sections: [...(enLedgerSections.get(surface) ?? [])],
  })),
  enScopedOut: [...enScopedOut.entries()].map(([surface, count]) => ({
    surface,
    count,
    sections: [...(enScopedOutSections.get(surface) ?? [])],
  })),
  grcScopedOut: [...grcScopedOut.entries()].map(([form, count]) => ({
    form,
    count,
    sections: [...(grcScopedOutSections.get(form) ?? [])],
  })),
  grcLedger: [...grcLedgerOcc.entries()].map(([form, count]) => ({
    form,
    count,
    reason: grcLedgerReason.get(form),
    sections: [...(grcLedgerSections.get(form) ?? [])],
  })),
  deadSurfaces,
};

const outPath = path.resolve(
  import.meta.dirname,
  "../../exports/annotation-coverage-audit.json",
);
writeFileSync(outPath, JSON.stringify(jsonOut, null, 2));
console.log(`\nfull detail: exports/annotation-coverage-audit.json`);
