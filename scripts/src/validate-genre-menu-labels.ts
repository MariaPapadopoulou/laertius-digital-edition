// The Laertius header/mobile menus were deliberately trimmed to LABEL-ONLY
// entries: no nav item carries a descriptive second line (`note:`) any more
// (2026-08: the "Textual genres" group was label-only first; the remaining
// groups were trimmed on external-review feedback). A future edit that adds
// a `note:` back to any nav item would silently reintroduce the second
// lines. This static check parses the navGroups / aboutGroup config out of
// layout.tsx and asserts:
//   - at least 5 groups parse (4 header groups + About), each with entries
//   - NO item in ANY group carries a `note`
//   - positive control: the note-detection regex fires on a synthetic item,
//     so the sweep cannot pass vacuously
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// The nav group data (NAV_GROUPS + ASK_GROUP + ABOUT_GROUP) is single-sourced
// in site-footer.tsx and imported by Layout for its header menus.
const layoutPath = path.join(
  here,
  "../../artifacts/laertius/src/components/site-footer.tsx",
);
const source = readFileSync(layoutPath, "utf8");

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// ——— Parse nav groups: `label: "Group", items: [ ... ]` blocks ———
type Item = { label: string; hasNote: boolean };
type Group = { label: string; items: Item[] };
const itemRe = /\{\s*href:\s*"[^"]+"\s*,\s*label:\s*"([^"]+)"([^}]*)\}/g;
const parseItems = (body: string): Item[] => {
  const items: Item[] = [];
  for (const im of body.matchAll(itemRe)) {
    items.push({ label: im[1]!, hasNote: /\bnote:\s*"/.test(im[2]!) });
  }
  return items;
};
const groups: Group[] = [];
const groupRe = /label:\s*"([^"]+)"\s*,\s*items:\s*\[([\s\S]*?)\n\s*\]/g;
for (const m of source.matchAll(groupRe)) {
  groups.push({ label: m[1]!, items: parseItems(m[2]!) });
}

console.log("validate-genre-menu-labels: nav config in layout.tsx");
check(
  "parsed at least 5 nav groups (4 header groups + About)",
  groups.length >= 5,
  `parsed: ${groups.map((g) => g.label).join(", ") || "(none)"}`,
);

// ——— Positive control: the note-detection regex fires on a synthetic item ———
const control = parseItems(
  `{ href: "/x", label: "X", note: "synthetic second line" }`,
);
check(
  "positive control: note-detection regex fires on a synthetic noted item",
  control.length === 1 && control[0]!.hasNote,
);

// ——— Under test: NO item in ANY group carries a note (label-only menus) ———
for (const group of groups) {
  check(
    `group "${group.label}" has at least one entry`,
    group.items.length > 0,
  );
  const noted = group.items.filter((i) => i.hasNote);
  check(
    `no "${group.label}" entry carries a note (label-only menu)`,
    noted.length === 0,
    noted.length ? `entries with notes: ${noted.map((i) => i.label).join(", ")}` : undefined,
  );
}

// Belt-and-braces: no `note:` property anywhere in the nav config source.
check(
  `layout.tsx contains no note: "..." nav property at all`,
  !/\bnote:\s*"/.test(source),
);

if (failures > 0) {
  console.error(`\nvalidate-genre-menu-labels: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-genre-menu-labels: all checks passed");
