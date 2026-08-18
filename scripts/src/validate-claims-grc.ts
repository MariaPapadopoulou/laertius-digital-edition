// Guards the "Source text" Greek quotation block and the provenance
// lines in the claims panel (claims-panel.tsx), shown on the Section,
// Browse, and Graph pages:
// 1. Unit-tests the pure predicates (claims-source-text.ts,
//    claims-provenance.ts): a claim with a non-empty grc excerpt must
//    show the block; a claim with no grc, an empty string, or
//    whitespace-only grc must NOT. A claim with a non-empty accordingTo
//    must show the "according to" attribution line; a claim with a
//    non-empty chain must show the "via" transmission line; absent or
//    empty fields must render nothing.
// 2. Pins the wiring: the panel must route the block and both
//    provenance lines through the shared predicates; the block must
//    keep its "Source text" label and lang="grc" attribute, the
//    attribution line its "according to" text plus the sourceWork
//    rendering, and the chain line its "via" text.
// 3. Pins the citation wiring: every claim line's "(D.L. ref)"
//    citation must render a /section/:id Link when the claim carries a
//    sectionId and fall back to plain text when it does not, and the
//    altTitle line must keep the same dual rendering over
//    altTitleSectionId/altTitleRef.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 3. Unit-tests the badge selectors (claims-badges.ts): reported,
//    disputed, and conjectured claims must get their certainty badge
//    ("some say", "disputed", "conjectured"), asserted claims none;
//    spurious/disputed-authorship/extant/lost claims must get their
//    transmission badge, suppressed when its label would duplicate the
//    certainty badge's. Pins the panel wiring through the selectors.
import { hasSourceText } from "../../artifacts/laertius/src/components/claims-source-text";
import {
  certaintyBadge,
  transmissionBadge,
} from "../../artifacts/laertius/src/components/claims-badges";
import {
  hasAttribution,
  hasChain,
} from "../../artifacts/laertius/src/components/claims-provenance";

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

console.log("Predicate behavior:");
check(
  "claim with a Greek excerpt shows the block",
  hasSourceText({ grc: "ὁ Θαλῆς ἔφη σοφώτατον χρόνον" }) === true,
);
check(
  "single-character excerpt shows the block",
  hasSourceText({ grc: "ᾧ" }) === true,
);
check(
  "excerpt with surrounding whitespace shows the block",
  hasSourceText({ grc: "  σοφόν τι τὸ σαφές  " }) === true,
);
check("claim without grc shows NO block", hasSourceText({}) === false);
check(
  "claim with undefined grc shows NO block",
  hasSourceText({ grc: undefined }) === false,
);
check(
  "claim with empty-string grc shows NO block",
  hasSourceText({ grc: "" }) === false,
);
check(
  "claim with whitespace-only grc shows NO block",
  hasSourceText({ grc: "  \n\t " }) === false,
);

console.log("Attribution predicate behavior:");
check(
  "claim with accordingTo shows the attribution line",
  hasAttribution({ accordingTo: "Hermippus" }) === true,
);
check(
  "attribution with surrounding whitespace still shows the line",
  hasAttribution({ accordingTo: "  Sosicrates  " }) === true,
);
check("claim without accordingTo shows NO line", hasAttribution({}) === false);
check(
  "claim with undefined accordingTo shows NO line",
  hasAttribution({ accordingTo: undefined }) === false,
);
check(
  "claim with empty-string accordingTo shows NO line",
  hasAttribution({ accordingTo: "" }) === false,
);
check(
  "claim with whitespace-only accordingTo shows NO line",
  hasAttribution({ accordingTo: " \n\t " }) === false,
);

console.log("Chain predicate behavior:");
check(
  "claim with a one-link chain shows the via line",
  hasChain({ chain: [{ authority: "Favorinus" }] }) === true,
);
check(
  "claim with a multi-link chain shows the via line",
  hasChain({
    chain: [
      { authority: "Favorinus", work: "Memorabilia" },
      { authority: "Hermippus" },
    ],
  }) === true,
);
check("claim without chain shows NO via line", hasChain({}) === false);
check(
  "claim with undefined chain shows NO via line",
  hasChain({ chain: undefined }) === false,
);
check(
  "claim with an empty chain shows NO via line",
  hasChain({ chain: [] }) === false,
);

console.log("Certainty badge behavior:");
check(
  'reported claims get the "some say" badge',
  certaintyBadge({ certainty: "reported" })?.label === "some say",
);
check(
  'disputed claims get the "disputed" badge',
  certaintyBadge({ certainty: "disputed" })?.label === "disputed",
);
check(
  'conjectured claims get the "conjectured" badge',
  certaintyBadge({ certainty: "conjectured" })?.label === "conjectured",
);
check(
  "asserted claims get NO certainty badge",
  certaintyBadge({ certainty: "asserted" }) === undefined,
);
check(
  "unknown certainty values get NO badge",
  certaintyBadge({ certainty: "unheard-of" }) === undefined,
);

console.log("Transmission badge behavior:");
check(
  'spurious works get the "spurious" badge',
  transmissionBadge({ certainty: "asserted", transmission: "spurious" })
    ?.label === "spurious",
);
check(
  'disputed-authorship works get the "disputed authorship" badge',
  transmissionBadge({
    certainty: "asserted",
    transmission: "disputed-authorship",
  })?.label === "disputed authorship",
);
check(
  'extant works get the "extant" badge',
  transmissionBadge({ certainty: "asserted", transmission: "extant" })
    ?.label === "extant",
);
check(
  'lost works get the "lost" badge',
  transmissionBadge({ certainty: "asserted", transmission: "lost" })?.label ===
    "lost",
);
check(
  "claims without transmission get NO transmission badge",
  transmissionBadge({ certainty: "reported" }) === undefined,
);
check(
  "unknown transmission values get NO badge",
  transmissionBadge({ certainty: "asserted", transmission: "mystery" }) ===
    undefined,
);
check(
  "a transmission badge duplicating the certainty label is suppressed (disputed + spurious kept apart, disputed + disputed collapses)",
  transmissionBadge({ certainty: "disputed", transmission: "spurious" })
    ?.label === "spurious",
);
check(
  "the duplicate-label suppression rule holds when labels match",
  (() => {
    // No current transmission status shares a label with a certainty
    // badge, so exercise the rule through the selector contract: for
    // every certainty/transmission pair, a rendered transmission badge
    // must never carry the same label as the certainty badge.
    const certainties = ["reported", "disputed", "conjectured", "asserted"];
    const transmissions = [
      "spurious",
      "disputed-authorship",
      "extant",
      "lost",
    ];
    for (const c of certainties) {
      for (const t of transmissions) {
        const cb = certaintyBadge({ certainty: c });
        const tb = transmissionBadge({ certainty: c, transmission: t });
        if (cb && tb && cb.label === tb.label) return false;
      }
    }
    return true;
  })(),
);
check(
  "reported + lost shows both badges independently",
  certaintyBadge({ certainty: "reported" })?.label === "some say" &&
    transmissionBadge({ certainty: "reported", transmission: "lost" })
      ?.label === "lost",
);

console.log("Wiring:");
const panelSource = readFileSync(
  path.join(laertiusSrc, "components/claims-panel.tsx"),
  "utf8",
);
check(
  "panel imports the shared predicate",
  panelSource.includes('from "./claims-source-text"'),
);
check(
  "panel gates the block on hasSourceText(claim)",
  /\{hasSourceText\(claim\)\s*&&/.test(panelSource),
);
// 2026-07: the Greek toggle task added a `showGreek &&` gate after the
// predicate; the block regexes below accept optional extra `<ident> &&`
// gates between hasSourceText(claim) and the opening paren, so the
// predicate remains the first guard and the block contract still pins.
check(
  "panel does NOT gate the block on raw claim.grc anymore",
  !/\{claim\.grc\s*&&/.test(panelSource),
);

// The gated block itself: from the hasSourceText guard to its closing
// paren, the label and the language-tagged excerpt must both survive.
// Extra guards after the predicate are allowed (e.g. the showGreek
// visibility toggle: `hasSourceText(claim) && showGreek && (`), as long
// as hasSourceText stays the first condition.
const blockMatch = panelSource.match(
  /\{hasSourceText\(claim\)(?:\s*&&\s*[\w.!$]+)*\s*&&\s*\(([\s\S]*?)\n\s*\)\}/,
);
check("the gated block is findable in the source", blockMatch !== null);
const block = blockMatch?.[1] ?? "";
check('the block carries the "Source text" label', block.includes("Source text"));
check(
  'the Greek excerpt is tagged lang="grc"',
  /lang="grc"/.test(block),
);
check(
  "the excerpt inside the block renders claim.grc",
  /\{claim\.grc\}/.test(block),
);

check(
  "panel imports the shared badge selectors",
  panelSource.includes('from "./claims-badges"'),
);
check(
  "panel derives the certainty badge via certaintyBadge(claim)",
  /=\s*certaintyBadge\(claim\)/.test(panelSource),
);
check(
  "panel derives the transmission badge via transmissionBadge(claim)",
  /=\s*transmissionBadge\(claim\)/.test(panelSource),
);
check(
  "panel keeps NO local badge tables",
  !/CERTAINTY_BADGE\s*:/.test(panelSource) &&
    !/TRANSMISSION_BADGE\s*:/.test(panelSource),
);
const badgeMatch = panelSource.match(
  /\{badge\s*&&\s*\(([\s\S]*?)\n\s*\)\}/,
);
check("the certainty badge block is findable in the source", badgeMatch !== null);
const badgeBlock = badgeMatch?.[1] ?? "";
check(
  "the certainty badge renders badge.label",
  /\{badge\.label\}/.test(badgeBlock),
);
check(
  "the certainty badge carries badge.className styling",
  /badge\.className/.test(badgeBlock),
);
const transmissionMatch = panelSource.match(
  /\{transmission\s*&&\s*\(([\s\S]*?)\n\s*\)\}/,
);
check(
  "the transmission badge block is findable in the source",
  transmissionMatch !== null,
);
const transmissionBlock = transmissionMatch?.[1] ?? "";
check(
  "the transmission badge renders transmission.label",
  /\{transmission\.label\}/.test(transmissionBlock),
);
check(
  "the transmission badge carries transmission.className styling",
  /transmission\.className/.test(transmissionBlock),
);
check(
  "the transmission badge is gated only on the selector (duplicate suppression lives in transmissionBadge, not inline)",
  !/transmission\.label\s*!==\s*badge/.test(panelSource),
);

check(
  "panel imports the shared provenance predicates",
  panelSource.includes('from "./claims-provenance"'),
);

check(
  "panel gates the attribution line on hasAttribution(claim)",
  /\{hasAttribution\(claim\)\s*&&/.test(panelSource),
);
check(
  "panel does NOT gate the attribution line on raw claim.accordingTo anymore",
  !/\{claim\.accordingTo\s*&&/.test(panelSource),
);
const attributionMatch = panelSource.match(
  /\{hasAttribution\(claim\)\s*&&\s*\(([\s\S]*?)\n\s*\)\}/,
);
check("the attribution line is findable in the source", attributionMatch !== null);
const attribution = attributionMatch?.[1] ?? "";
check(
  'the attribution line carries the "according to" text',
  attribution.includes("according to"),
);
check(
  "the attribution line renders claim.accordingTo",
  /\{claim\.accordingTo\}/.test(attribution),
);
check(
  "the attribution line renders sourceWork when set",
  /claim\.sourceWork\s*&&/.test(attribution) &&
    /\{claim\.sourceWork\}/.test(attribution),
);

check(
  "panel gates the chain line on hasChain(claim)",
  /\{hasChain\(claim\)\s*&&/.test(panelSource),
);
check(
  "panel does NOT gate the chain line on raw claim.chain anymore",
  !/\{claim\.chain\s*&&/.test(panelSource),
);
// The chain line renders nested JSX (Index links per authority/work), so
// the block runs to the closing </span> of the via line, not the first ")}"
const chainMatch = panelSource.match(
  /\{hasChain\(claim\)\s*&&\s*\(([\s\S]*?)<\/span>\n\s*\)\}/,
);
check("the chain line is findable in the source", chainMatch !== null);
const chainBlock = chainMatch?.[1] ?? "";
check('the chain line carries the "via" text', chainBlock.includes("via"));
check(
  "the chain line renders the chain entries (authority, with work when set)",
  /claim\.chain/.test(chainBlock) &&
    /l\.authority/.test(chainBlock) &&
    /l\.work/.test(chainBlock),
);
check(
  "the chain line links authorities to the Index when authorityUri is set",
  /l\.authorityUri\s*\?/.test(chainBlock) &&
    /entities\?entity=\$\{encodeURIComponent\(l\.authorityUri\)\}/.test(
      chainBlock,
    ) &&
    /\{l\.authority\}/.test(chainBlock),
);
check(
  "the chain line links works to the Index when workUri is set",
  /l\.workUri\s*\?/.test(chainBlock) &&
    /entities\?entity=\$\{encodeURIComponent\(l\.workUri\)\}/.test(chainBlock) &&
    /\{l\.work\}/.test(chainBlock),
);

console.log("Citation wiring:");
const citationMatch = panelSource.match(
  /function CitationLink\(\{ claim \}[\s\S]*?\n\}/,
);
check("the CitationLink component is findable in the source", citationMatch !== null);
const citation = citationMatch?.[0] ?? "";
check(
  'the citation label renders "D.L. <ref>"',
  /D\.L\. \$\{claim\.ref\}/.test(citation),
);
check(
  "a missing sectionId falls back to plain text (early return before the Link)",
  /if \(!claim\.sectionId\)[\s\S]*?return\s*(?:\()?\s*<span/.test(citation),
);
check(
  "the plain-text fallback renders no Link",
  (() => {
    const fallback = citation.match(
      /if \(!claim\.sectionId\)\s*\{([\s\S]*?)\n\s*\}/,
    );
    return fallback !== null && !/<Link/.test(fallback[1]);
  })(),
);
check(
  "a claim with a sectionId links to /section/:id",
  /<Link\s[\s\S]*?href=\{`\/section\/\$\{claim\.sectionId\}`\}/.test(citation),
);
check(
  "every claim line renders its citation through CitationLink",
  /<CitationLink claim=\{claim\} \/>/.test(panelSource),
);

console.log("altTitle citation wiring:");
const altMatch = panelSource.match(
  /\{claim\.altTitle\s*&&\s*\(([\s\S]*?)\n\s*\)\}/,
);
check("the altTitle line is findable in the source", altMatch !== null);
const alt = altMatch?.[1] ?? "";
check(
  'the altTitle line carries the "also titled" text and renders claim.altTitle',
  alt.includes("also titled") && /\{claim\.altTitle\}/.test(alt),
);
check(
  "the altTitle citation is a ternary over altTitleSectionId",
  /claim\.altTitleSectionId\s*\?/.test(alt),
);
check(
  "the altTitle link branch points at /section/:id",
  /<Link\s[\s\S]*?href=\{`\/section\/\$\{claim\.altTitleSectionId\}`\}/.test(alt),
);
check(
  "both altTitle branches render the D.L. altTitleRef citation",
  (alt.match(/D\.L\. \{claim\.altTitleRef\}/g) ?? []).length >= 2,
);
check(
  "the altTitle fallback branch is plain text (no Link after the colon)",
  (() => {
    const idx = alt.indexOf(": (");
    const colon = idx >= 0 ? idx : alt.lastIndexOf(") : ");
    if (colon < 0) return false;
    return !/<Link/.test(alt.slice(colon));
  })(),
);

console.log("Works expander wiring:");
// The Works group previews only the first WORKS_PREVIEW claims behind a
// "Show all N entries" toggle. A refactor that drops the toggle, the
// full list, or nukes the preview constant would silently hide most of
// a prolific author's writings roster, so pin the wiring here.
const previewConstMatch = panelSource.match(
  /const WORKS_PREVIEW\s*=\s*(\d+)\s*;/,
);
check(
  "the WORKS_PREVIEW constant is declared with a numeric literal",
  previewConstMatch !== null,
);
const previewCount = previewConstMatch ? Number(previewConstMatch[1]) : NaN;
check(
  "WORKS_PREVIEW is a sane preview size (>= 2, an accidental 0 or 1 fails loudly)",
  Number.isInteger(previewCount) && previewCount >= 2,
);
check(
  "panel keeps a worksExpanded state toggle",
  /const \[worksExpanded, setWorksExpanded\]\s*=\s*useState/.test(panelSource),
);
check(
  "the shown list is the full list when expanded, else the WORKS_PREVIEW slice",
  /const shown\s*=\s*worksExpanded\s*\?\s*all\s*:\s*all\.slice\(0,\s*WORKS_PREVIEW\)/.test(
    panelSource,
  ),
);
check(
  "the Works group renders the shown list (not the raw preview slice)",
  /\{shown\.map\(\(c\)\s*=>/.test(panelSource),
);
const worksToggleMatch = panelSource.match(
  /\{all\.length\s*>\s*WORKS_PREVIEW\s*&&\s*\(([\s\S]*?)\n\s*\)\}/,
);
check(
  "the expander toggle is findable and gated on all.length > WORKS_PREVIEW",
  worksToggleMatch !== null,
);
const worksToggle = worksToggleMatch?.[1] ?? "";
check(
  "the toggle flips worksExpanded on click",
  /setWorksExpanded\(\(v\)\s*=>\s*!v\)/.test(worksToggle),
);
check(
  'the collapsed label reads "Show all N entries" with the full count',
  /`Show all \$\{all\.length\} entries`/.test(worksToggle),
);
check(
  'the expanded label reads "Show fewer"',
  worksToggle.includes('"Show fewer"'),
);
check(
  "the toggle is a ternary over worksExpanded (both states reachable)",
  /worksExpanded\s*\?/.test(worksToggle),
);

if (failures > 0) {
  console.error(`\nvalidate-claims-grc: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-claims-grc: all checks passed");
