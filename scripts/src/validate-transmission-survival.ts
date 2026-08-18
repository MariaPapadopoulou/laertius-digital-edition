/**
 * Cross-checks the two independent survival axes carried by the site:
 *
 *  - lo:transmissionStatus — what D.L. himself reports, derived from
 *    wrote-claim notes (getWorkTransmission() in
 *    artifacts/api-server/src/lib/kg-ontology.ts). "lost" means D.L.
 *    reports the work itself destroyed (burnt).
 *  - lo:survival — the modern verdict, curated per work in
 *    artifacts/api-server/src/lib/work-ontology/* (absent = lost by
 *    default; explicit null = deliberately unasserted for conflated
 *    homonym nodes with divergent transmission).
 *
 * The two axes can legitimately disagree, but a work D.L. says was
 * destroyed that the modern facet calls "extant" is almost certainly a
 * curation slip. This validator flags every (D.L.-lost, modern-extant)
 * pair unless the work is explicitly reviewed in the allowlist below with
 * a note, and includes a positive control so the check cannot go
 * vacuously green.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-transmission-survival
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getWorkTransmission } = await import(
  "../../artifacts/api-server/src/lib/kg-ontology"
);
const { WORK_FACETS } = await import(
  "../../artifacts/api-server/src/lib/work-ontology"
);
type WorkTransmission = import(
  "../../artifacts/api-server/src/lib/kg-ontology"
).WorkTransmission;
type WorkFacet = import(
  "../../artifacts/api-server/src/lib/work-ontology/types"
).WorkFacet;

let failed = false;
const fail = (msg: string): void => {
  failed = true;
  console.error(`TRANSMISSION/SURVIVAL FAILED: ${msg}`);
};

/**
 * Works whose (D.L.-lost, modern-extant) disagreement has been reviewed by
 * a human and judged genuine. Every entry MUST carry a non-empty note
 * explaining why the pair is plausible after all. Currently empty: no such
 * pair is known, and any new one should be treated as a curation slip
 * until reviewed.
 */
const REVIEWED_DISAGREEMENTS: Record<string, string> = {};

/**
 * Mirror direction: works D.L. reports as extant ("extant in a single
 * volume") whose curated modern lo:survival facet is "lost". This is much
 * weaker evidence of a slip — works genuinely perished between D.L.'s day
 * and the manuscript tradition — but every such pair must still be
 * reviewed: either confirmed here as a genuine post-antique loss (with a
 * non-empty note saying so) or the curation fixed.
 */
const REVIEWED_EXTANT_LOST: Record<string, string> = {
  "That men are not made good by instruction":
    "One of Crito's seventeen dialogues extant in a single volume in D.L.'s day (2.121); " +
    "none of Crito's dialogues survived the manuscript tradition - genuine post-antique loss.",
  "Of the Gods":
    "One of Simon the shoemaker's thirty-three 'leathern' dialogues extant in a single volume " +
    "in D.L.'s day (2.122); Simon's corpus did not survive antiquity - genuine post-antique loss.",
  "Phidylus":
    "One of Glaucon's nine dialogues extant in a single volume in D.L.'s day (2.124); " +
    "Glaucon's dialogues are wholly lost today - genuine post-antique loss.",
  "On Wisdom":
    "One of Simmias' twenty-three dialogues extant in a single volume in D.L.'s day (2.124); " +
    "Simmias' dialogues did not reach the manuscript tradition - genuine post-antique loss.",
};

/**
 * Resolve the modern survival verdict for a facet:
 *  - absent `survival` key -> "lost" (the unmarked default; see types.ts)
 *  - explicit null -> "unasserted" (conflated homonym with divergent
 *    transmission; no single verdict exists, so no cross-check applies)
 */
function modernSurvival(facet: WorkFacet): "lost" | "excerpts" | "extant" | "unasserted" {
  if (!("survival" in facet)) return "lost";
  return facet.survival ?? "unasserted";
}

/**
 * Pure checker over an explicit dataset so the positive control can drive
 * it with synthetic data. Returns human-readable violation strings for
 * every D.L.-lost work whose modern facet says "extant" and that is not
 * covered by a noted allowlist entry; also reports transmission works
 * missing from the facet table (the cross-check would otherwise silently
 * skip them) and unused / note-less allowlist entries.
 */
function findViolations(
  transmission: WorkTransmission[],
  facets: Record<string, WorkFacet>,
  allowlist: Record<string, string>,
): string[] {
  const violations: string[] = [];
  const lostWorks = new Set(
    transmission.filter((t) => t.status === "lost").map((t) => t.work),
  );
  for (const t of transmission) {
    if (t.status !== "lost") continue;
    const facet = facets[t.work];
    if (!facet) {
      violations.push(
        `D.L.-lost work "${t.work}" (${t.ref}) has no entry in WORK_FACETS - cannot cross-check`,
      );
      continue;
    }
    if (modernSurvival(facet) !== "extant") continue;
    const note = allowlist[t.work];
    if (note !== undefined && note.trim().length > 0) continue;
    if (note !== undefined) {
      violations.push(
        `allowlist entry for "${t.work}" has an empty note - a reviewed disagreement must say why`,
      );
      continue;
    }
    violations.push(
      `"${t.work}": D.L. reports it destroyed (${t.ref}${t.note ? `: ${t.note}` : ""}) ` +
        `but the curated modern survival facet says "extant" - review the curation ` +
        `or add a noted entry to REVIEWED_DISAGREEMENTS`,
    );
  }
  for (const work of Object.keys(allowlist)) {
    if (!lostWorks.has(work)) {
      violations.push(
        `stale allowlist entry "${work}": no D.L.-lost transmission record exists for it`,
      );
    }
  }
  return violations;
}

/**
 * Mirror-direction checker: D.L.-extant works whose modern facet resolves
 * to "lost". Pure over an explicit dataset so the positive control can
 * drive it. Also reports D.L.-extant works missing from the facet table
 * (the cross-check would otherwise silently skip them) and stale or
 * note-less allowlist entries.
 */
function findExtantLostViolations(
  transmission: WorkTransmission[],
  facets: Record<string, WorkFacet>,
  allowlist: Record<string, string>,
): string[] {
  const violations: string[] = [];
  const extantWorks = new Set(
    transmission.filter((t) => t.status === "extant").map((t) => t.work),
  );
  for (const t of transmission) {
    if (t.status !== "extant") continue;
    const facet = facets[t.work];
    if (!facet) {
      violations.push(
        `D.L.-extant work "${t.work}" (${t.ref}) has no entry in WORK_FACETS - cannot cross-check`,
      );
      continue;
    }
    if (modernSurvival(facet) !== "lost") continue;
    const note = allowlist[t.work];
    if (note !== undefined && note.trim().length > 0) continue;
    if (note !== undefined) {
      violations.push(
        `allowlist entry for "${t.work}" has an empty note - a reviewed post-antique loss must say why`,
      );
      continue;
    }
    violations.push(
      `"${t.work}": D.L. reports it extant (${t.ref}${t.note ? `: ${t.note}` : ""}) ` +
        `but the curated modern survival facet says "lost" - confirm it as a genuine ` +
        `post-antique loss (add a noted entry to REVIEWED_EXTANT_LOST) or fix the curation`,
    );
  }
  for (const work of Object.keys(allowlist)) {
    if (!extantWorks.has(work)) {
      violations.push(
        `stale extant-lost allowlist entry "${work}": no D.L.-extant transmission record exists for it`,
      );
    }
  }
  return violations;
}

// ------------------------------------------------------------ positive control
// Prove the checker actually fires on the exact failure mode it guards
// against, so a refactor that makes it match nothing cannot go green.
{
  const fakeTransmission: WorkTransmission[] = [
    { work: "Synthetic Burnt Work", status: "lost", ref: "0.0", note: "burnt (synthetic)" },
    { work: "Synthetic Fine Work", status: "extant", ref: "0.0" },
  ];
  const fakeFacets: Record<string, WorkFacet> = {
    "Synthetic Burnt Work": { form: "prose", topic: "ethics", survival: "extant" },
    "Synthetic Fine Work": { form: "prose", topic: "ethics", survival: "extant" },
  };
  const hits = findViolations(fakeTransmission, fakeFacets, {});
  if (hits.length !== 1 || !hits[0]!.includes("Synthetic Burnt Work")) {
    fail(
      `positive control broken: expected exactly 1 violation for "Synthetic Burnt Work", got ` +
        `${hits.length}: ${JSON.stringify(hits)}`,
    );
  } else {
    console.log("positive control (synthetic lost+extant pair flagged): OK");
  }
  // An allowlisted entry with a note must suppress the violation...
  const allowed = findViolations(fakeTransmission, fakeFacets, {
    "Synthetic Burnt Work": "reviewed: D.L. is wrong here (synthetic)",
  });
  if (allowed.length !== 0) {
    fail(
      `positive control broken: noted allowlist entry did not suppress the violation: ` +
        JSON.stringify(allowed),
    );
  } else {
    console.log("positive control (noted allowlist entry suppresses): OK");
  }
  // ...but a note-less entry must NOT.
  const noteless = findViolations(fakeTransmission, fakeFacets, {
    "Synthetic Burnt Work": "  ",
  });
  if (noteless.length !== 1 || !noteless[0]!.includes("empty note")) {
    fail(
      `positive control broken: empty-note allowlist entry was not rejected: ` +
        JSON.stringify(noteless),
    );
  } else {
    console.log("positive control (empty-note allowlist entry rejected): OK");
  }
  // A missing facet must be reported, not silently skipped.
  const missingFacet = findViolations(
    [{ work: "Synthetic Unfaceted Work", status: "lost", ref: "0.0" }],
    {},
    {},
  );
  if (missingFacet.length !== 1 || !missingFacet[0]!.includes("no entry in WORK_FACETS")) {
    fail(
      `positive control broken: missing facet not reported: ${JSON.stringify(missingFacet)}`,
    );
  } else {
    console.log("positive control (missing facet reported): OK");
  }
}

// -------------------------------------- positive control (extant-lost mirror)
{
  const fakeTransmission: WorkTransmission[] = [
    { work: "Synthetic Perished Work", status: "extant", ref: "0.0", note: "extant in a single volume (synthetic)" },
    { work: "Synthetic Surviving Work", status: "extant", ref: "0.0" },
  ];
  const fakeFacets: Record<string, WorkFacet> = {
    "Synthetic Perished Work": { form: "prose", topic: "ethics" }, // absent survival -> lost
    "Synthetic Surviving Work": { form: "prose", topic: "ethics", survival: "extant" },
  };
  const hits = findExtantLostViolations(fakeTransmission, fakeFacets, {});
  if (hits.length !== 1 || !hits[0]!.includes("Synthetic Perished Work")) {
    fail(
      `positive control broken: expected exactly 1 violation for "Synthetic Perished Work", got ` +
        `${hits.length}: ${JSON.stringify(hits)}`,
    );
  } else {
    console.log("positive control (synthetic extant+lost pair flagged): OK");
  }
  const allowed = findExtantLostViolations(fakeTransmission, fakeFacets, {
    "Synthetic Perished Work": "reviewed: genuine post-antique loss (synthetic)",
  });
  if (allowed.length !== 0) {
    fail(
      `positive control broken: noted extant-lost allowlist entry did not suppress the violation: ` +
        JSON.stringify(allowed),
    );
  } else {
    console.log("positive control (noted extant-lost allowlist entry suppresses): OK");
  }
  const noteless = findExtantLostViolations(fakeTransmission, fakeFacets, {
    "Synthetic Perished Work": "  ",
  });
  if (noteless.length !== 1 || !noteless[0]!.includes("empty note")) {
    fail(
      `positive control broken: empty-note extant-lost allowlist entry was not rejected: ` +
        JSON.stringify(noteless),
    );
  } else {
    console.log("positive control (empty-note extant-lost allowlist entry rejected): OK");
  }
  const missingFacet = findExtantLostViolations(
    [{ work: "Synthetic Unfaceted Extant Work", status: "extant", ref: "0.0" }],
    {},
    {},
  );
  if (missingFacet.length !== 1 || !missingFacet[0]!.includes("no entry in WORK_FACETS")) {
    fail(
      `positive control broken: missing facet for extant work not reported: ${JSON.stringify(missingFacet)}`,
    );
  } else {
    console.log("positive control (missing facet for extant work reported): OK");
  }
  const stale = findExtantLostViolations([], {}, {
    "Synthetic Vanished Work": "note",
  });
  if (stale.length !== 1 || !stale[0]!.includes("stale extant-lost allowlist entry")) {
    fail(
      `positive control broken: stale extant-lost allowlist entry not reported: ${JSON.stringify(stale)}`,
    );
  } else {
    console.log("positive control (stale extant-lost allowlist entry reported): OK");
  }
}

// ------------------------------------------------------------------ real data
const transmission = getWorkTransmission();
const lostCount = transmission.filter((t) => t.status === "lost").length;
if (lostCount === 0) {
  fail(
    "no D.L.-lost transmission records found at all - the LOST_RE derivation " +
      "in kg-ontology.ts appears broken, so this cross-check would be vacuous",
  );
} else {
  console.log(
    `cross-checking ${lostCount} D.L.-lost works (of ${transmission.length} ` +
      `transmission records) against ${Object.keys(WORK_FACETS).length} curated facets`,
  );
}
const violations = findViolations(transmission, WORK_FACETS, REVIEWED_DISAGREEMENTS);
for (const v of violations) fail(v);
if (violations.length === 0 && lostCount > 0) {
  console.log("no implausible D.L.-lost + modern-extant pairs: OK");
}

const extantCount = transmission.filter((t) => t.status === "extant").length;
if (extantCount === 0) {
  fail(
    "no D.L.-extant transmission records found at all - the extant derivation " +
      "in kg-ontology.ts appears broken, so the mirror cross-check would be vacuous",
  );
} else {
  console.log(
    `cross-checking ${extantCount} D.L.-extant works against curated facets (mirror direction)`,
  );
}
const extantLostViolations = findExtantLostViolations(
  transmission,
  WORK_FACETS,
  REVIEWED_EXTANT_LOST,
);
for (const v of extantLostViolations) fail(v);
if (extantLostViolations.length === 0 && extantCount > 0) {
  console.log(
    "all D.L.-extant + modern-lost pairs reviewed as genuine post-antique losses: OK",
  );
}

if (failed) process.exit(1);
console.log("transmission/survival cross-check passed");
