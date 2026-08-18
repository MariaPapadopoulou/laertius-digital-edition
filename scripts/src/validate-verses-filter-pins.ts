/**
 * Guards the pinned filter expectations in e2e-verses-filters.ts against
 * silent drift when the curated verse-authors layer changes.
 *
 * The e2e script pins exact verse ids for three filter outcomes (Plato,
 * Plato+epigram, Empedocles+Book 9), but it needs live servers so it isn't
 * part of the always-on validation suite. This source-level validator
 * recomputes the same three listVerses() outcomes and asserts the ids equal
 * the PIN_* arrays parsed straight from the e2e script's source, so a
 * curator edit to verse-authors.ts fails here immediately.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run validate-verses-filter-pins
 */
import { readFileSync } from "node:fs";
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { listVerses } = await import(
  "../../artifacts/api-server/src/lib/verses"
);

const E2E_PATH = path.resolve(import.meta.dirname, "e2e-verses-filters.ts");
const e2eSource = readFileSync(E2E_PATH, "utf8");

/** Parse a `const NAME = [ "..." , ... ];` string-array literal from source. */
function parsePinArray(name: string): string[] {
  const m = e2eSource.match(
    new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`),
  );
  if (!m) {
    throw new Error(
      `could not find \`const ${name} = [...]\` in ${E2E_PATH} — was the e2e script refactored? Update this validator's parser to match.`,
    );
  }
  const ids = [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
  if (ids.length === 0) {
    throw new Error(`parsed ${name} from ${E2E_PATH} but found no ids`);
  }
  return ids;
}

let failures = 0;
function checkScenario(
  label: string,
  pinName: string,
  query: Parameters<typeof listVerses>[0],
) {
  const pinned = parsePinArray(pinName);
  const actual = listVerses(query).map((v) => v.id);
  if (JSON.stringify(actual) === JSON.stringify(pinned)) {
    console.log(`ok: ${label} — ${actual.length} ids match ${pinName}`);
    return;
  }
  failures++;
  console.error(`FAIL: ${label}`);
  console.error(`  pinned (${pinName}): ${JSON.stringify(pinned)}`);
  console.error(`  actual listVerses:   ${JSON.stringify(actual)}`);
  console.error(
    `  The curated verse-authors layer (artifacts/api-server/src/lib/verse-authors.ts) no longer matches the pinned e2e expectations. Update the ${pinName} constant in scripts/src/e2e-verses-filters.ts to the actual ids above (and re-run the e2e script when servers are up).`,
  );
}

checkScenario('listVerses({author:"Plato"})', "PIN_PLATO_IDS", {
  author: "Plato",
});
checkScenario(
  'listVerses({author:"Plato", genre:"epigram"})',
  "PIN_PLATO_EPIGRAM_IDS",
  { author: "Plato", genre: "epigram" },
);
checkScenario(
  'listVerses({author:"Empedocles", book:9})',
  "PIN_EMPEDOCLES_BOOK9_IDS",
  { author: "Empedocles", book: 9 },
);

if (failures > 0) {
  console.error(`\nvalidate-verses-filter-pins: ${failures} scenario(s) FAILED`);
  process.exit(1);
}
console.log("\nvalidate-verses-filter-pins: all filter pins match");
