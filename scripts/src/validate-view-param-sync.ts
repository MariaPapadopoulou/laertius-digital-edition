// Guards the Map/Timeline "vs List" toggle's URL sync (?view=list),
// mirroring graph.tsx. A refactor of either page's view state could
// silently drop the sync, and screen-reader users would again lose
// their list preference on every reload. For each page this pins:
// 1. Initialization: the view state is seeded from ?view= at mount.
// 2. Adoption: a useSearch()-driven effect adopts the URL's view when
//    the search string changes (back/forward, links with ?view=list).
// 3. Write-back: an effect writes the view back to the URL with
//    history.replaceState (set "view"="list" / delete when default).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.join(here, "../../artifacts/laertius/src/pages");

let failures = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

/** Pages whose Map/Timeline-vs-List toggle must stay synced to ?view=. */
const PAGES: { file: string; defaultView: string }[] = [
  { file: "map.tsx", defaultView: "map" },
  { file: "timeline.tsx", defaultView: "timeline" },
];

for (const { file, defaultView } of PAGES) {
  const src = readFileSync(path.join(pagesDir, file), "utf8");
  console.log(`pages/${file}:`);

  // 1. Initialize from ?view= — a useState whose lazy initializer reads
  //    the current location's "view" param and maps "list" to the list
  //    view, anything else to the page's default view.
  const init = new RegExp(
    "useState<\\\"" +
      defaultView +
      "\\\"\\s*\\|\\s*\\\"list\\\">\\(\\(\\)\\s*=>\\s*" +
      "new URLSearchParams\\(window\\.location\\.search\\)\\.get\\(\\\"view\\\"\\)\\s*===\\s*\\\"list\\\"" +
      "\\s*\\?\\s*\\\"list\\\"\\s*:\\s*\\\"" +
      defaultView +
      "\\\"",
  );
  check(`view state initialized from ?view= (default "${defaultView}")`, init.test(src));

  // 2. Adopt URL changes — the page subscribes to wouter's search string
  //    (useSearch strips nothing here; useLocation would drop the query)
  //    and an effect keyed on it re-reads ?view= and setView()s.
  check("subscribes to the search string via useSearch()", /const\s+search\s*=\s*useSearch\(\)/.test(src));
  //    The params object may be assigned to a local (const params = new
  //    URLSearchParams(search)) before .get("view") — both forms count.
  const adopt = new RegExp(
    "new URLSearchParams\\(search\\)[\\s\\S]{0,120}?\\.get\\(\\\"view\\\"\\)\\s*===\\s*\\\"list\\\"\\s*\\?\\s*\\\"list\\\"\\s*:\\s*\\\"" +
      defaultView +
      "\\\"[\\s\\S]{0,200}?setView\\(",
  );
  check("adopts ?view= from the search string in an effect", adopt.test(src));
  //    The same effect may also adopt other params (?p=, ?school=, ...)
  //    between the setView call and the dependency array.
  check(
    "adoption effect depends on the search string",
    /setView\(\(cur\)\s*=>\s*\(cur === v \? cur : v\)\);[\s\S]{0,1200}?\}, \[search\]\);/.test(src),
  );

  // 3. Write back — an effect keyed on `view` (possibly alongside other
  //    URL-synced state such as the school filter) sets/deletes the
  //    "view" param and commits it with history.replaceState (no new
  //    history entry per toggle).
  const writeBack =
    /url\.searchParams\.set\("view",\s*"list"\);\s*else url\.searchParams\.delete\("view"\);[\s\S]{0,600}?history\.replaceState\([\s\S]{0,300}?\}, \[view[\],]/;
  check("writes ?view= back with history.replaceState keyed on view", writeBack.test(src));
}

if (failures > 0) {
  console.error(`\nvalidate-view-param-sync: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-view-param-sync: all checks passed");
