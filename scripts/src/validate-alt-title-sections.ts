/**
 * Sweeps EVERY philosopher's works claims (the same payload /api/claims
 * serves, via buildPhilosopherClaims in routes/graph.ts) and asserts each
 * citation target is sound — both the claim's PRIMARY citation (sectionId
 * from sectionIdForRef(c.ref, c.subject)) and each "also titled" note:
 *
 * 0. every resolved primary sectionId names a real corpus section with
 *    non-empty passage text (Greek or English);
 * 1. every claim carrying altTitle/altTitleRef also resolves an
 *    altTitleSectionId (otherwise the note renders a dead plain-text
 *    citation instead of a link);
 * 2. every altTitleSectionId names a real corpus section;
 * 3. that section has non-empty passage text (Greek or English), since
 *    the section page must render the passage the note points at.
 *
 * The live-browser check (e2e-works-citation.ts) clicks only the FIRST
 * alt-title citation; this data-level validator covers all of them
 * (e.g. every Plato dialogue's catalogue note). Failures name the entry,
 * its alt title, and the bad section id.
 *
 * Prints positive counts so it can't pass vacuously.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-alt-title-sections
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getClaims } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { buildPhilosopherClaims } = await import(
  "../../artifacts/api-server/src/routes/graph"
);

const errors: string[] = [];

// All philosophers that carry any works claim.
const subjects = [
  ...new Set(
    getClaims()
      .filter((c) => c.property === "writings" || c.property === "wrote")
      .map((c) => c.subject),
  ),
];
if (subjects.length === 0) {
  errors.push("no subjects with works claims found — validator would pass vacuously");
}

let worksChecked = 0;
let altChecked = 0;
let primaryChecked = 0;
for (const subject of subjects) {
  const claims = buildPhilosopherClaims(subject) as {
    property: string;
    value: string;
    ref?: string;
    sectionId?: string;
    altTitle?: string;
    altTitleRef?: string;
    altTitleSectionId?: string;
  }[];
  for (const c of claims) {
    if (c.property !== "writings" && c.property !== "wrote") continue;
    worksChecked++;
    // PRIMARY citation: when the works claim's own ref resolved to a
    // sectionId, that section must exist and carry passage text — the
    // reader clicks the citation and lands on the passage page.
    if (c.sectionId) {
      primaryChecked++;
      const label = `${subject}'s "${c.value}" (ref ${c.ref ?? "?"})`;
      const section = sectionById.get(c.sectionId);
      if (!section) {
        errors.push(
          `${label}: primary sectionId "${c.sectionId}" is not a corpus section — the citation lands on Section Not Found`,
        );
      } else if (!(section.textEn || section.text || "").trim()) {
        errors.push(
          `${label}: primary citation target ${c.sectionId} has no passage text — the link lands on an empty page`,
        );
      }
    }
    if (!c.altTitle && !c.altTitleRef && !c.altTitleSectionId) continue;
    altChecked++;
    const who = `${subject}'s "${c.value}" (also titled "${c.altTitle ?? "?"}", ref ${c.altTitleRef ?? "?"})`;
    if (!c.altTitle || !c.altTitleRef) {
      errors.push(`${who}: alt-title fields are incomplete (altTitle/altTitleRef must both be set)`);
      continue;
    }
    if (!c.altTitleSectionId) {
      errors.push(
        `${who}: altTitleSectionId did not resolve — the "also titled" citation renders as dead text instead of a link`,
      );
      continue;
    }
    const section = sectionById.get(c.altTitleSectionId);
    if (!section) {
      errors.push(
        `${who}: altTitleSectionId "${c.altTitleSectionId}" is not a corpus section — the link lands on Section Not Found`,
      );
      continue;
    }
    const passage = (section.textEn || section.text || "").trim();
    if (!passage) {
      errors.push(
        `${who}: target section ${c.altTitleSectionId} has no passage text — the link lands on an empty page`,
      );
    }
  }
}

if (primaryChecked === 0) {
  errors.push(
    "no works claim resolved a primary sectionId — validator would pass vacuously",
  );
}

if (altChecked === 0) {
  errors.push(
    "no works claim carries an alt title — validator would pass vacuously (expected e.g. Plato's catalogue notes)",
  );
}

if (errors.length > 0) {
  console.error(`validate-alt-title-sections: ${errors.length} error(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-alt-title-sections: OK — ${primaryChecked} primary citation(s) and ${altChecked} alt-title citation(s) across ${worksChecked} works claims (${subjects.length} philosophers) each resolve to a real section with passage text.`,
);
