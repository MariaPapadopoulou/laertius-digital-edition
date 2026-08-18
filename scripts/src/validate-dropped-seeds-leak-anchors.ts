/* Anchor-drift guard for dryrun-dropped-seeds-note-leak.ts.
 *
 * Decision (documented here, referenced from the dry run header): the full
 * dry run needs both servers plus headless Chromium and runs the whole
 * e2e-dropped-seeds-note suite twice, so it is too heavy to run on every
 * merge. It stays a manual/on-demand check
 * (`pnpm --filter @workspace/scripts run dryrun-dropped-seeds-note-leak`),
 * to be re-run whenever competency.tsx's droppedSeeds handling or the e2e's
 * switching layer changes materially.
 *
 * What CAN drift silently between manual runs are the dry run's textual
 * anchors, making it fail loudly at the worst time (or, worse, never get
 * run at all against drifted anchors). This cheap static validator runs on
 * every merge and pins each anchor to its source of truth:
 *
 * 1. The dry run's ANCHOR line (the healthy droppedSeeds assignment) must
 *    still appear verbatim in artifacts/laertius/src/pages/competency.tsx.
 * 2. The failure-message regex the dry run greps for
 *    (`FAIL: after switching to "<id>" the note is gone`) must still match
 *    the check label the e2e actually emits.
 * 3. The cold-load contrast "ok" line the dry run expects must match the
 *    e2e's contrast check label, including the current literal values of
 *    CONTRAST_QUESTION_ID and NOTE_PHRASE.
 * 4. The API-sweep "ok" regex and the final success line the dry run
 *    expects must match what the e2e emits.
 *
 * All expectations are EXTRACTED from dryrun-dropped-seeds-note-leak.ts
 * itself (no third copy of the strings to drift) and verified against the
 * current competency.tsx / e2e-dropped-seeds-note.ts sources. Positive
 * controls mutate each source in memory and require the corresponding
 * check to fail, proving none of the comparisons is vacuous.
 *
 * Run: pnpm --filter @workspace/scripts run validate-dropped-seeds-leak-anchors
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const DRYRUN = path.join(HERE, "dryrun-dropped-seeds-note-leak.ts");
const E2E = path.join(HERE, "e2e-dropped-seeds-note.ts");
const PAGE = path.join(REPO_ROOT, "artifacts/laertius/src/pages/competency.tsx");

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ok: ${label}`);
  else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

const dryrunSrc = readFileSync(DRYRUN, "utf8");
const e2eSrc = readFileSync(E2E, "utf8");
const pageSrc = readFileSync(PAGE, "utf8");

// ---- Extract the dry run's expectations from its own source ----

// const ANCHOR = "  const droppedSeeds = ...";
function extractAnchor(src: string): string | null {
  const m = src.match(/const ANCHOR =\s*("(?:[^"\\]|\\.)*");/);
  if (!m) return null;
  return JSON.parse(m[1]) as string;
}

// The literal strings the dry run greps for in the e2e output.
function extractExpectedLiterals(src: string): {
  goneRegexBody: string | null;
  contrastOkLine: string | null;
  sweepRegexBody: string | null;
  successLine: string | null;
} {
  const gone = src.match(
    /const gone = \/(FAIL: after switching to [^/]+the note is gone)\/g;/,
  );
  const contrast = src.match(
    /leaky\.output\.includes\(\s*'(ok: no element on [^']+)'/,
  );
  const sweep = src.match(
    /\/(ok: sweep verified [^/]+empty droppedSeeds)\/\.test\(/,
  );
  const success = src.match(
    /clean\.output\.includes\("(All dropped-seeds[^"]+)"\)/,
  );
  return {
    goneRegexBody: gone ? gone[1] : null,
    contrastOkLine: contrast ? contrast[1] : null,
    sweepRegexBody: sweep ? sweep[1] : null,
    successLine: success ? success[1] : null,
  };
}

// ---- Extract the e2e's actual emissions from its source ----

function extractE2eFacts(src: string): {
  goneLabelTemplate: boolean;
  contrastId: string | null;
  notePhrase: string | null;
  contrastLabelTemplate: boolean;
  sweepLabelTemplate: boolean;
  successLine: string | null;
} {
  const contrastId = src.match(/const CONTRAST_QUESTION_ID = "([^"]+)"/);
  const notePhrase = src.match(/const NOTE_PHRASE = "([^"]+)"/);
  const success = src.match(/console\.log\(\s*"\\n(All dropped-seeds[^"]+)"/);
  return {
    goneLabelTemplate: src.includes(
      '`after switching to "${targetId}" the note is gone`',
    ),
    contrastId: contrastId ? contrastId[1] : null,
    notePhrase: notePhrase ? notePhrase[1] : null,
    contrastLabelTemplate: src.includes(
      "`no element on ${CONTRAST_QUESTION_ID} contains \"${NOTE_PHRASE}\"`",
    ),
    sweepLabelTemplate: src.includes(
      "`sweep verified ${sweepChecked} no-exception question(s) with empty droppedSeeds`",
    ),
    successLine: success ? success[1] : null,
  };
}

// ---- The comparison itself, factored so positive controls can reuse it ----

function evaluate(
  dryrun: string,
  e2e: string,
  page: string,
): { label: string; ok: boolean; detail?: string }[] {
  const out: { label: string; ok: boolean; detail?: string }[] = [];
  const anchor = extractAnchor(dryrun);
  out.push({
    label: "dry run declares an ANCHOR string",
    ok: !!anchor,
  });
  out.push({
    label: "competency.tsx still contains the dry run's ANCHOR line verbatim",
    ok: !!anchor && page.includes(anchor),
    detail: anchor ?? undefined,
  });

  const exp = extractExpectedLiterals(dryrun);
  const facts = extractE2eFacts(e2e);

  out.push({
    label: "dry run greps the 'note is gone' failure message",
    ok:
      exp.goneRegexBody ===
      'FAIL: after switching to "([^"]+)" the note is gone',
    detail: exp.goneRegexBody ?? "regex not found in dry run",
  });
  out.push({
    label: "e2e still emits the 'note is gone' label the dry run greps",
    ok: facts.goneLabelTemplate,
  });

  const expectedContrastLine =
    facts.contrastId && facts.notePhrase
      ? `ok: no element on ${facts.contrastId} contains "${facts.notePhrase}"`
      : null;
  out.push({
    label:
      "dry run's cold-load contrast line matches the e2e's current CONTRAST_QUESTION_ID + NOTE_PHRASE",
    ok:
      !!exp.contrastOkLine &&
      !!expectedContrastLine &&
      exp.contrastOkLine === expectedContrastLine &&
      facts.contrastLabelTemplate,
    detail: `dryrun=${JSON.stringify(exp.contrastOkLine)} e2e-derived=${JSON.stringify(expectedContrastLine)}`,
  });

  out.push({
    label: "dry run's API-sweep regex matches the e2e's sweep label",
    ok:
      exp.sweepRegexBody ===
        "ok: sweep verified \\d+ no-exception question\\(s\\) with empty droppedSeeds" &&
      facts.sweepLabelTemplate,
    detail: exp.sweepRegexBody ?? "sweep regex not found in dry run",
  });

  out.push({
    label: "dry run's success line matches the e2e's final success message",
    ok:
      !!exp.successLine &&
      !!facts.successLine &&
      exp.successLine === facts.successLine,
    detail: `dryrun=${JSON.stringify(exp.successLine)} e2e=${JSON.stringify(facts.successLine)}`,
  });
  return out;
}

console.log("Anchor sync: dryrun-dropped-seeds-note-leak vs sources of truth");
for (const r of evaluate(dryrunSrc, e2eSrc, pageSrc)) {
  check(r.label, r.ok, r.detail);
}

// ---- Positive controls: each comparison must be able to fail ----
console.log("\nPositive controls (mutated sources must fail)");

function countFailures(
  dryrun: string,
  e2e: string,
  page: string,
): number {
  return evaluate(dryrun, e2e, page).filter((r) => !r.ok).length;
}

check(
  "control: renaming droppedSeeds in competency.tsx trips the ANCHOR check",
  countFailures(
    dryrunSrc,
    e2eSrc,
    pageSrc.replace(/droppedSeeds/g, "removedSeeds"),
  ) > 0,
);
check(
  "control: rewording the e2e 'note is gone' label trips the check",
  countFailures(
    dryrunSrc,
    e2eSrc.replace("the note is gone", "the note has vanished"),
    pageSrc,
  ) > 0,
);
check(
  "control: changing the e2e NOTE_PHRASE trips the contrast-line check",
  countFailures(
    dryrunSrc,
    e2eSrc.replace(
      'const NOTE_PHRASE = "without a Life of their own"',
      'const NOTE_PHRASE = "with no Life of their own"',
    ),
    pageSrc,
  ) > 0,
);
check(
  "control: rewording the e2e sweep label trips the sweep check",
  countFailures(
    dryrunSrc,
    e2eSrc.replace(
      "no-exception question(s) with empty droppedSeeds",
      "clean question(s) with empty droppedSeeds",
    ),
    pageSrc,
  ) > 0,
);
check(
  "control: rewording the e2e success line trips the success check",
  countFailures(
    dryrunSrc,
    e2eSrc.replace(
      "All dropped-seeds note visibility checks passed",
      "Dropped-seeds note checks all green",
    ),
    pageSrc,
  ) > 0,
);
check(
  "control: rewording the dry run's expected success line trips the check",
  countFailures(
    dryrunSrc.replace(
      "All dropped-seeds note visibility checks passed",
      "Everything passed",
    ),
    e2eSrc,
    pageSrc,
  ) > 0,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log(
  "\nAll dropped-seeds leak-dryrun anchor checks passed (dry run itself stays manual/on-demand — see header)",
);
