// Guards the same-page nav reset (use-reset-on-same-page-nav.ts):
// 1. Unit-tests the pure click-filtering predicate: a plain same-page nav
//    click must reset; a query-string same-page link (in-place filter nav
//    like /anecdotes?involves=X), a different pathname, another origin, or
//    a new-tab link must NOT reset.
// 2. Pins the wiring: the hook must route its decision through the
//    predicate, and the known roster of pages must actually use the hook.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { shouldResetOnSamePageNav } from "../../artifacts/laertius/src/hooks/same-page-nav-reset";

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

const HOME = { origin: "https://humanisticadigitalia.eu", pathname: "/" };
const ANECDOTES = {
  origin: "https://humanisticadigitalia.eu",
  pathname: "/anecdotes",
};

function link(overrides: Partial<Parameters<typeof shouldResetOnSamePageNav>[0]>) {
  return {
    origin: ANECDOTES.origin,
    pathname: ANECDOTES.pathname,
    search: "",
    target: "",
    ...overrides,
  };
}

console.log("Predicate behavior:");
check(
  "plain same-page nav click resets",
  shouldResetOnSamePageNav(link({}), ANECDOTES) === true,
);
check(
  "logo click on the home page resets",
  shouldResetOnSamePageNav(link({ pathname: "/" }), HOME) === true,
);
check(
  "query-string same-page link (in-place filter nav) does NOT reset",
  shouldResetOnSamePageNav(link({ search: "?involves=Zeno" }), ANECDOTES) ===
    false,
);
check(
  "link to a different page does NOT reset",
  shouldResetOnSamePageNav(link({ pathname: "/sayings" }), ANECDOTES) === false,
);
check(
  "trailing-slash variant of another path does NOT reset",
  shouldResetOnSamePageNav(link({ pathname: "/anecdotes/" }), ANECDOTES) ===
    false,
);
check(
  "cross-origin link does NOT reset",
  shouldResetOnSamePageNav(
    link({ origin: "https://example.org" }),
    ANECDOTES,
  ) === false,
);
check(
  "new-tab link does NOT reset",
  shouldResetOnSamePageNav(link({ target: "_blank" }), ANECDOTES) === false,
);
check(
  "new-tab link does NOT reset even with a query string",
  shouldResetOnSamePageNav(
    link({ target: "_blank", search: "?involves=Zeno" }),
    ANECDOTES,
  ) === false,
);

console.log("Wiring:");
const hookSource = readFileSync(
  path.join(laertiusSrc, "hooks/use-reset-on-same-page-nav.ts"),
  "utf8",
);
check(
  "hook imports the shared predicate",
  hookSource.includes('from "./same-page-nav-reset"'),
);
check(
  "hook calls shouldResetOnSamePageNav in its click handler",
  /shouldResetOnSamePageNav\s*\(/.test(hookSource),
);
check(
  "hook listens in the capture phase",
  hookSource.includes('addEventListener("click", onClickCapture, true)'),
);
check(
  "hook passes the anchor's search string to the predicate",
  /search:\s*anchor\.search/.test(hookSource),
);

// Roster of pages that must keep the same-page reset. Update this list
// deliberately when a page gains or loses the hook.
const HOOK_PAGES = [
  "anecdotes.tsx",
  "doxography.tsx",
  "entities.tsx",
  "ask.tsx",
  "epistles.tsx",
  "sayings.tsx",
  "search.tsx",
  "terminology/names.tsx",
  "terminology/objects.tsx",
  "verses.tsx",
];
for (const page of HOOK_PAGES) {
  const src = readFileSync(path.join(laertiusSrc, "pages", page), "utf8");
  check(
    `pages/${page} uses useResetOnSamePageNav`,
    /useResetOnSamePageNav\s*\(/.test(src),
  );
}

if (failures > 0) {
  console.error(`\nvalidate-nav-reset: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-nav-reset: all checks passed");
