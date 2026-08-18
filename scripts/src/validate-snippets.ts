/**
 * Validates the passage-preview snippet builder (buildSnippet in
 * artifacts/api-server/src/routes/annotations.ts). The builder computes
 * UTF-16 offsets into a trimmed excerpt with an ellipsis prefix; an
 * off-by-one there would silently highlight the wrong characters on
 * every passage card. This validator asserts:
 *
 * 1. Synthetic edge cases: hits at the very start / very end of the
 *    text, hits deep inside (ellipsis prefix in play), short and long
 *    fallback texts, and null text.
 * 2. A full corpus sweep replicating the /annotations/sections route:
 *    for EVERY tagged entity in every section where it has an English
 *    tag, snippet.slice(snippetStart, snippetEnd) must equal the tagged
 *    surface (text.slice(hit.start, hit.end)); fallback snippets (no
 *    English hit) must carry NO highlight offsets; sections without
 *    English text must return no snippet at all.
 * 3. Positive controls (a vacuously green sweep is worthless): named
 *    entities exercise each branch - Pythagoras (highlighted snippets),
 *    a Greek-only-tagged occurrence (fallback, no offsets), and a
 *    catalogue-backed work with no in-section tags (fallback).
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-snippets
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { buildSnippet } = await import(
  "../../artifacts/api-server/src/routes/annotations"
);
const { annotateSection, getIndexEntries, sectionsForEntity } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { corpus, sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);

const errors: string[] = [];

// ---------------------------------------------------------------------
// 1. Synthetic edge cases
// ---------------------------------------------------------------------
function checkHighlighted(
  label: string,
  text: string,
  hit: { start: number; end: number },
) {
  const out = buildSnippet(text, [hit]);
  if (!out) {
    errors.push(`${label}: expected a snippet, got undefined`);
    return;
  }
  if (out.snippetStart === undefined || out.snippetEnd === undefined) {
    errors.push(`${label}: expected highlight offsets, got none`);
    return;
  }
  const want = text.slice(hit.start, hit.end);
  const got = out.snippet.slice(out.snippetStart, out.snippetEnd);
  if (got !== want) {
    errors.push(`${label}: highlight mismatch: want "${want}", got "${got}"`);
  }
}

const LONG =
  "Alpha bravo charlie delta echo foxtrot golf hotel india juliett kilo " +
  "lima mike november oscar papa quebec romeo sierra tango uniform victor " +
  "whiskey xray yankee zulu one two three four five six seven eight nine " +
  "ten eleven twelve thirteen fourteen fifteen sixteen seventeen end.";

checkHighlighted("synthetic/at-start", LONG, { start: 0, end: 5 });
checkHighlighted("synthetic/at-end", LONG, {
  start: LONG.length - 4,
  end: LONG.length,
});
const mid = LONG.indexOf("quebec");
checkHighlighted("synthetic/mid-with-ellipsis", LONG, {
  start: mid,
  end: mid + "quebec".length,
});
{
  const out = buildSnippet(LONG, [{ start: mid, end: mid + 6 }]);
  if (out && !out.snippet.startsWith("\u2026")) {
    errors.push("synthetic/mid-with-ellipsis: expected an ellipsis prefix");
  }
}
{
  const out = buildSnippet("short text", []);
  if (!out || out.snippet !== "short text") {
    errors.push("synthetic/short-fallback: expected the full text back");
  } else if (out.snippetStart !== undefined || out.snippetEnd !== undefined) {
    errors.push("synthetic/short-fallback: fallback must carry no offsets");
  }
}
{
  const out = buildSnippet(LONG, []);
  if (!out) {
    errors.push("synthetic/long-fallback: expected a snippet");
  } else {
    if (out.snippetStart !== undefined || out.snippetEnd !== undefined) {
      errors.push("synthetic/long-fallback: fallback must carry no offsets");
    }
    if (!out.snippet.endsWith("\u2026")) {
      errors.push("synthetic/long-fallback: expected a trailing ellipsis");
    }
    if (!LONG.startsWith(out.snippet.slice(0, -1).trimEnd())) {
      errors.push("synthetic/long-fallback: snippet is not a prefix of text");
    }
  }
}
if (buildSnippet(null, []) !== undefined) {
  errors.push("synthetic/null-text: expected undefined for missing English");
}

// ---------------------------------------------------------------------
// 2. Full corpus sweep (route-equivalent, one annotate pass per section)
// ---------------------------------------------------------------------
let highlighted = 0;
let fallbacks = 0;
let noEnglish = 0;

// entityUri -> per-branch counts, for the positive controls below.
const branchByEntity = new Map<
  string,
  { highlighted: number; fallback: number }
>();

for (const section of corpus) {
  const anns = annotateSection(section);
  const byEntity = new Map<string, { start: number; end: number }[]>();
  const entitiesHere = new Set<string>();
  for (const a of anns) {
    entitiesHere.add(a.entityUri);
    if (a.lang !== "en") continue;
    let list = byEntity.get(a.entityUri);
    if (!list) byEntity.set(a.entityUri, (list = []));
    list.push({ start: a.start, end: a.end });
  }
  for (const entity of entitiesHere) {
    const enHits = (byEntity.get(entity) ?? []).sort(
      (a, b) => a.start - b.start,
    );
    const out = buildSnippet(section.textEn, enHits);
    const where = `${entity} @ ${section.id}`;
    if (!section.textEn) {
      noEnglish++;
      if (out !== undefined) {
        errors.push(`${where}: section has no English but got a snippet`);
      }
      continue;
    }
    if (!out) {
      errors.push(`${where}: English text present but no snippet returned`);
      continue;
    }
    const branches = branchByEntity.get(entity) ?? {
      highlighted: 0,
      fallback: 0,
    };
    const hit = enHits[0];
    if (!hit) {
      fallbacks++;
      branches.fallback++;
      if (out.snippetStart !== undefined || out.snippetEnd !== undefined) {
        errors.push(`${where}: fallback snippet must carry no offsets`);
      }
    } else {
      highlighted++;
      branches.highlighted++;
      if (out.snippetStart === undefined || out.snippetEnd === undefined) {
        errors.push(`${where}: English hit but no highlight offsets`);
      } else {
        const want = section.textEn.slice(hit.start, hit.end);
        const got = out.snippet.slice(out.snippetStart, out.snippetEnd);
        if (got !== want) {
          errors.push(
            `${where}: highlight mismatch: want "${want}", got "${got}"`,
          );
        }
      }
    }
    branchByEntity.set(entity, branches);
  }
}

// Catalogue-backed entities (double-titled dialogues) carry no tags in
// their sections; the route still builds a fallback snippet for them.
const tagged = new Set(branchByEntity.keys());
let catalogueFallbacks = 0;
for (const entry of getIndexEntries()) {
  if (tagged.has(entry.entityUri)) continue;
  const ids = sectionsForEntity(entry.entityUri) ?? [];
  for (const id of ids) {
    const section = sectionById.get(id);
    if (!section) {
      errors.push(`${entry.entityUri}: unknown section ${id}`);
      continue;
    }
    const out = buildSnippet(section.textEn, []);
    if (!section.textEn) continue;
    if (!out) {
      errors.push(`${entry.entityUri} @ ${id}: no snippet for catalogue entry`);
      continue;
    }
    catalogueFallbacks++;
    if (out.snippetStart !== undefined || out.snippetEnd !== undefined) {
      errors.push(
        `${entry.entityUri} @ ${id}: catalogue fallback must carry no offsets`,
      );
    }
  }
}

// ---------------------------------------------------------------------
// 3. Positive controls: each branch must actually fire.
// ---------------------------------------------------------------------
if (highlighted === 0) errors.push("sweep never exercised a highlighted snippet");
if (fallbacks === 0) errors.push("sweep never exercised a Greek-only fallback");
if (catalogueFallbacks === 0) {
  errors.push("sweep never exercised a catalogue-backed fallback");
}

function entityByLabel(label: string): string | null {
  const entry = getIndexEntries().find((e) => e.label === label);
  return entry ? entry.entityUri : null;
}

const pythagoras = entityByLabel("Pythagoras");
if (!pythagoras) {
  errors.push('positive control: no index entry labelled "Pythagoras"');
} else {
  const b = branchByEntity.get(pythagoras);
  if (!b || b.highlighted === 0) {
    errors.push("positive control: Pythagoras produced no highlighted snippet");
  }
}

// An entity that is somewhere tagged only in the Greek: its fallback
// branch fired at least once for at least one philosopher-kind entity.
const greekOnly = [...branchByEntity.entries()].filter(
  ([, b]) => b.fallback > 0,
);
if (greekOnly.length === 0) {
  errors.push(
    "positive control: no entity ever hit the Greek-only fallback branch",
  );
}

// ---------------------------------------------------------------------
if (errors.length > 0) {
  console.error(`validate-snippets: ${errors.length} error(s)\n`);
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`);
  if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`);
  process.exit(1);
}
console.log(
  `validate-snippets OK: ${highlighted} highlighted, ${fallbacks} Greek-only fallbacks, ` +
    `${catalogueFallbacks} catalogue fallbacks, ${noEnglish} no-English cases, ` +
    `${branchByEntity.size} entities exercised`,
);
