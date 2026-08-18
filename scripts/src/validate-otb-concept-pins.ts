/**
 * validate-otb-concept-pins — catches the IONOS bundle smoke test's OTB
 * concept/category pins silently drifting from the concept inventory.
 *
 * History: the smoke test hard-coded the concept count in two places (the
 * /api/otb/overview counts check and the ontology-viewer "N concepts, "
 * content control), and an inventory edit surfaced only at the END of the
 * expensive bundle build. The pins now derive from the SAME inventory
 * module (scripts/src/otb-concept-pins.ts imports CONCEPTS/CATEGORIES from
 * artifacts/api-server/src/lib/otb/inventory.ts). This fast validator
 * guards that contract:
 *
 *  1. The derived pins equal the live inventory lengths (proves the import
 *     path still resolves the real inventory, e.g. after a refactor that
 *     leaves otb-concept-pins pointing at a stale copy).
 *  2. The smoke-test source consumes the derived constants: it imports
 *     from ./otb-concept-pins and references OTB_CONCEPT_PIN_COUNT,
 *     OTB_CATEGORY_PIN_COUNT and OTB_VIEWER_CONCEPT_STATS_FRAGMENT.
 *  3. No hard-coded pin sneaks back into the smoke test: no
 *     `counts.concepts !== <number>` comparison and no "<number> concepts, "
 *     string literal in the source.
 *  4. Positive controls: the pure check functions are re-run against
 *     deliberately broken inputs (a mutated inventory, a source with the
 *     old hard-coded literals, a source missing the imports) and must flag
 *     every seeded defect, so the validator cannot pass vacuously.
 *
 * Run: pnpm --filter @workspace/scripts run validate-otb-concept-pins
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CATEGORIES,
  CONCEPTS,
} from "../../artifacts/api-server/src/lib/otb/inventory";
import {
  OTB_CATEGORY_PIN_COUNT,
  OTB_CONCEPT_PIN_COUNT,
  OTB_VIEWER_CONCEPT_STATS_FRAGMENT,
} from "./otb-concept-pins";

const here = path.dirname(fileURLToPath(import.meta.url));
const smokeSourcePath = path.join(here, "smoke-ionos-bundle.ts");

/** 1. Derived pins must equal the live inventory. Pure for positive controls. */
function checkPinsAgainstInventory(inputs: {
  conceptPin: number;
  categoryPin: number;
  viewerFragment: string;
  conceptCount: number;
  categoryCount: number;
}): string[] {
  const problems: string[] = [];
  if (inputs.conceptPin !== inputs.conceptCount) {
    problems.push(
      `derived concept pin (${inputs.conceptPin}) != live CONCEPTS.length (${inputs.conceptCount})`,
    );
  }
  if (inputs.categoryPin !== inputs.categoryCount) {
    problems.push(
      `derived category pin (${inputs.categoryPin}) != live CATEGORIES.length (${inputs.categoryCount})`,
    );
  }
  const expectedFragment = `${inputs.conceptCount} concepts, `;
  if (inputs.viewerFragment !== expectedFragment) {
    problems.push(
      `viewer stats fragment "${inputs.viewerFragment}" != expected "${expectedFragment}"`,
    );
  }
  return problems;
}

/** 2+3. The smoke test must use the derived constants, never literals. */
function checkSmokeSource(src: string): string[] {
  const problems: string[] = [];
  if (!/from\s+"\.\/otb-concept-pins"/.test(src)) {
    problems.push('smoke-ionos-bundle.ts no longer imports from "./otb-concept-pins"');
  }
  for (const ident of [
    "OTB_CONCEPT_PIN_COUNT",
    "OTB_CATEGORY_PIN_COUNT",
    "OTB_VIEWER_CONCEPT_STATS_FRAGMENT",
  ]) {
    // Must appear outside the import block too (i.e. at least twice).
    const uses = src.split(ident).length - 1;
    if (uses < 2) {
      problems.push(
        `smoke-ionos-bundle.ts references ${ident} ${uses} time(s); expected the import plus at least one use`,
      );
    }
  }
  // Old-style hard pins: a numeric comparison on counts.concepts/categories…
  const hardComparison = src.match(
    /counts\.(concepts|categories)\s*!==\s*\d+/,
  );
  if (hardComparison) {
    problems.push(
      `hard-coded numeric pin re-introduced in smoke-ionos-bundle.ts: "${hardComparison[0]}" (use otb-concept-pins instead)`,
    );
  }
  // …or a "<N> concepts" string literal (content control or log line).
  const hardLiteral = src.match(/["'`]\s*\d+ concepts?[,)]/);
  if (hardLiteral) {
    problems.push(
      `hard-coded "<N> concepts" literal re-introduced in smoke-ionos-bundle.ts: ${JSON.stringify(hardLiteral[0])} (use otb-concept-pins instead)`,
    );
  }
  return problems;
}

function main(): number {
  let failures = 0;
  const fail = (msg: string) => {
    failures += 1;
    console.error(`  ✗ ${msg}`);
  };

  // --- live checks -------------------------------------------------------
  console.log("otb-concept-pins: derived pins vs live inventory");
  const liveInputs = {
    conceptPin: OTB_CONCEPT_PIN_COUNT,
    categoryPin: OTB_CATEGORY_PIN_COUNT,
    viewerFragment: OTB_VIEWER_CONCEPT_STATS_FRAGMENT,
    conceptCount: CONCEPTS.length,
    categoryCount: CATEGORIES.length,
  };
  for (const p of checkPinsAgainstInventory(liveInputs)) fail(p);
  if (failures === 0) {
    console.log(
      `  ✓ pins track inventory (${CONCEPTS.length} concepts, ${CATEGORIES.length} categories)`,
    );
  }

  console.log("otb-concept-pins: smoke-test source uses derived constants");
  const smokeSrc = readFileSync(smokeSourcePath, "utf8");
  const srcProblems = checkSmokeSource(smokeSrc);
  for (const p of srcProblems) fail(p);
  if (srcProblems.length === 0) {
    console.log("  ✓ smoke-ionos-bundle.ts consumes otb-concept-pins, no hard-coded pins");
  }

  // --- positive controls -------------------------------------------------
  console.log("otb-concept-pins: positive controls");

  // A. inventory drift must be flagged (simulates an inventory edit with a
  //    pin module that somehow kept the old value).
  const drifted = checkPinsAgainstInventory({
    ...liveInputs,
    conceptCount: CONCEPTS.length + 1,
  });
  if (drifted.length < 2) {
    // both the count pin and the viewer fragment must trip
    fail(
      `positive control A: simulated inventory drift raised ${drifted.length} problem(s), expected 2`,
    );
  } else {
    console.log("  ✓ control A: simulated inventory drift is flagged");
  }

  // B. category drift alone must be flagged.
  const catDrift = checkPinsAgainstInventory({
    ...liveInputs,
    categoryCount: CATEGORIES.length + 1,
  });
  if (catDrift.length !== 1) {
    fail(
      `positive control B: simulated category drift raised ${catDrift.length} problem(s), expected 1`,
    );
  } else {
    console.log("  ✓ control B: simulated category drift is flagged");
  }

  // C. the old hard-coded style must be flagged (comparison + literal),
  //    seeded into the real source so the import checks still pass.
  const regressed =
    smokeSrc +
    '\nif (counts.concepts !== 30) {}\nconst x = "30 concepts, ";\n';
  const regressionProblems = checkSmokeSource(regressed);
  if (
    !regressionProblems.some((p) => p.includes("counts.concepts")) ||
    !regressionProblems.some((p) => p.includes('concepts" literal') || p.includes("literal"))
  ) {
    fail(
      `positive control C: seeded hard-coded pins raised ${JSON.stringify(regressionProblems)}, expected both the comparison and the literal to be flagged`,
    );
  } else {
    console.log("  ✓ control C: re-introduced hard-coded pins are flagged");
  }

  // D. a source that dropped the derived-constant usage must be flagged.
  const stripped = smokeSrc
    .replace(/from\s+"\.\/otb-concept-pins"/g, 'from "./nowhere"')
    .split("OTB_CONCEPT_PIN_COUNT")
    .join("SOMETHING_ELSE");
  const strippedProblems = checkSmokeSource(stripped);
  if (strippedProblems.length < 2) {
    fail(
      `positive control D: stripped source raised ${strippedProblems.length} problem(s), expected the import and the constant use to be flagged`,
    );
  } else {
    console.log("  ✓ control D: dropped derived-constant usage is flagged");
  }

  if (failures > 0) {
    console.error(`\nvalidate-otb-concept-pins: ${failures} check(s) failed`);
    return 1;
  }
  console.log("\nvalidate-otb-concept-pins: all checks passed");
  return 0;
}

process.exit(main());
