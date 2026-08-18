// Guards the /competency ?focus= URL validation (competency-focus.ts):
// a shared link can carry any focus value, and the page must only open the
// "Passages naming X" drill-down panel when the name is actually a node of
// the loaded subgraph; an unknown name shows a dismissible notice instead.
//
// 1. Unit-tests the pure resolveCompetencyFocus predicate: a valid focus
//    (present in the node list) opens the panel and never the notice; an
//    invalid focus yields no panel and, once the result has loaded, the
//    notice; while loading (or with no result) neither shows.
// 2. Pins the wiring: pages/competency.tsx must route its decision through
//    the predicate, gate the panel on the validated name only, and gate the
//    notice on the stale flag.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCompetencyFocus } from "../../artifacts/laertius/src/lib/competency-focus";

const here = path.dirname(fileURLToPath(import.meta.url));
const laertiusSrc = path.join(here, "../../artifacts/laertius/src");

let failures = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

// A representative loaded subgraph (stoa-members style roster).
const NODES = ["Zeno of Citium", "Cleanthes", "Chrysippus"];

function resolve(overrides: Partial<Parameters<typeof resolveCompetencyFocus>[0]>) {
  return resolveCompetencyFocus({
    focusedEntity: null,
    nodeNames: NODES,
    resultLoading: false,
    hasResult: true,
    ...overrides,
  });
}

console.log("Predicate behavior:");

const valid = resolve({ focusedEntity: "Cleanthes" });
check(
  "valid focus (Cleanthes on the roster) opens the panel",
  valid.validFocusedEntity === "Cleanthes",
);
check("valid focus shows no stale notice", valid.staleFocus === false);

const invalid = resolve({ focusedEntity: "Socrates" });
check(
  "focus absent from result nodes does NOT open the panel",
  invalid.validFocusedEntity === null,
);
check(
  "focus absent from result nodes shows the notice",
  invalid.staleFocus === true,
);

const loading = resolve({
  focusedEntity: "Socrates",
  resultLoading: true,
  hasResult: false,
});
check(
  "while loading, an unknown focus opens no panel",
  loading.validFocusedEntity === null,
);
check(
  "while loading, no premature stale notice",
  loading.staleFocus === false,
);

const noResult = resolve({
  focusedEntity: "Socrates",
  resultLoading: false,
  hasResult: false,
});
check(
  "with no result loaded, no panel and no notice",
  noResult.validFocusedEntity === null && noResult.staleFocus === false,
);

const noFocus = resolve({ focusedEntity: null });
check(
  "no focus param: no panel, no notice",
  noFocus.validFocusedEntity === null && noFocus.staleFocus === false,
);

const empty = resolve({ focusedEntity: "Cleanthes", nodeNames: [] });
check(
  "focus never opens a panel against an empty node list",
  empty.validFocusedEntity === null,
);

check(
  "exact-name match only (case-sensitive, no substring)",
  resolve({ focusedEntity: "cleanthes" }).validFocusedEntity === null &&
    resolve({ focusedEntity: "Clean" }).validFocusedEntity === null,
);

console.log("Wiring:");
const pageSource = readFileSync(
  path.join(laertiusSrc, "pages/competency.tsx"),
  "utf8",
);
check(
  "competency.tsx imports the shared predicate",
  pageSource.includes('from "@/lib/competency-focus"'),
);
check(
  "competency.tsx destructures validFocusedEntity and staleFocus from the predicate",
  /\{\s*validFocusedEntity,\s*staleFocus\s*\}\s*=\s*resolveCompetencyFocus\s*\(/.test(
    pageSource,
  ),
);
check(
  "predicate is fed the result nodes' names",
  /nodeNames:\s*nodes\.map\(\s*\(n\)\s*=>\s*n\.name\s*\)/.test(pageSource),
);
check(
  "the drill-down panel is gated on validFocusedEntity, never the raw focus",
  /\{validFocusedEntity\s*&&\s*\(\s*<FocusedEntityPanel/.test(pageSource) &&
    !/\{focusedEntity\s*&&\s*\(\s*<FocusedEntityPanel/.test(pageSource),
);
check(
  "FocusedEntityPanel receives the validated name only",
  /<FocusedEntityPanel\s+name=\{validFocusedEntity\}/.test(pageSource) &&
    !/<FocusedEntityPanel\s+name=\{focusedEntity\}/.test(pageSource),
);
check(
  "the stale-focus notice is gated on staleFocus",
  /\{staleFocus\s*&&\s*\(/.test(pageSource),
);
check(
  "the notice names the rejected focus value",
  /is not in this question's subgraph/.test(pageSource) &&
    /\{focusedEntity\}/.test(pageSource),
);

if (failures > 0) {
  console.error(`\nvalidate-competency-focus: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-competency-focus: all checks passed");
