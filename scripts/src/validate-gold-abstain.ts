/**
 * validate-gold-abstain — the official gold set must keep ALL THREE abstention
 * subtypes (out_of_corpus, false_premise, underspecified_homonym) above a
 * minimum count, so abstention evaluation never silently measures only one
 * behaviour again (the v0.2 incident: only out_of_corpus was present and
 * nobody noticed).
 *
 * Rules:
 *  1. The official gold file is the highest-versioned `gold-*vX.Y.jsonl` in
 *     artifacts/api-server/data/eval/gold/. Files whose basename starts with
 *     "draft" are excluded (drafts are staging material, not the gold set).
 *  2. Every abstention topic (must_abstain === true) must carry a valid
 *     abstain_type, and each of the three types must reach MIN_PER_TYPE.
 *  3. There are NO waivers: an incomplete gold set fails outright. (The
 *     historical v0.2 KNOWN_INCOMPLETE waiver was retired once v0.3 shipped
 *     with all three subtypes.)
 *  4. Drift guard: the three type strings here must still match the
 *     ABSTAIN_TYPES set in the api-server eval store source.
 *  4b. Version pin: the picked official file's version must equal the
 *     version recorded in gold/CURRENT_VERSION (the single source of truth
 *     that ingest scripts bump when shipping a new gold set). If the newest
 *     gold file is deleted or down-versioned, the check fails loudly naming
 *     the expected version instead of silently falling back to an older set.
 *  5. Positive controls: the checker is re-run against deliberately broken
 *     in-memory inputs (a type removed, a type below threshold, a v0.2-style
 *     incomplete set, a draft file trying to contribute) and must flag each.
 *
 * Run: pnpm --filter @workspace/scripts run validate-gold-abstain
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const GOLD_DIR = path.join(repoRoot, "artifacts", "api-server", "data", "eval", "gold");
const STORE_SRC = path.join(
  repoRoot,
  "artifacts",
  "api-server",
  "src",
  "lib",
  "eval",
  "store.ts",
);

const ABSTAIN_TYPES = ["out_of_corpus", "false_premise", "underspecified_homonym"] as const;
type AbstainType = (typeof ABSTAIN_TYPES)[number];

/** Minimum abstention topics required per subtype in the official gold set. */
const MIN_PER_TYPE = 5;

interface CheckInput {
  /** basename → raw JSONL content, as found in the gold dir */
  files: Record<string, string>;
  /**
   * Expected official version ("major.minor"), from gold/CURRENT_VERSION.
   * The picked official file must carry exactly this version.
   */
  expectedVersion: string;
}

interface CheckResult {
  errors: string[];
  warnings: string[];
  officialFile?: string;
  counts?: Record<string, number>;
}

const OFFICIAL_RE = /^gold-.*v(\d+)\.(\d+)\.jsonl$/;

function checkGold(input: CheckInput): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const official = Object.keys(input.files)
    .filter((f) => !f.startsWith("draft") && OFFICIAL_RE.test(f))
    .sort((a, b) => {
      const [aj, an] = a.match(OFFICIAL_RE)!.slice(1).map(Number);
      const [bj, bn] = b.match(OFFICIAL_RE)!.slice(1).map(Number);
      return aj - bj || an - bn;
    });

  if (official.length === 0) {
    errors.push(
      `No official gold file (gold-*vX.Y.jsonl, non-draft) found among: ${Object.keys(input.files).join(", ") || "(none)"}`,
    );
    return { errors, warnings };
  }

  const officialFile = official[official.length - 1];

  const vm = officialFile.match(OFFICIAL_RE)!;
  const pickedVersion = `${Number(vm[1])}.${Number(vm[2])}`;
  const expected = input.expectedVersion.trim();
  if (!/^\d+\.\d+$/.test(expected)) {
    errors.push(
      `CURRENT_VERSION pin is malformed: ${JSON.stringify(input.expectedVersion)} (expected "major.minor", e.g. "0.3")`,
    );
    return { errors, warnings, officialFile };
  }
  if (pickedVersion !== expected) {
    errors.push(
      `Official gold pick is v${pickedVersion} (${officialFile}) but gold/CURRENT_VERSION pins v${expected}. ` +
        `The expected gold-*v${expected}.jsonl file is missing, renamed, or down-versioned — ` +
        `restore it, or bump CURRENT_VERSION deliberately when shipping a new gold set. ` +
        `Never let an older file silently become the official set.`,
    );
    return { errors, warnings, officialFile };
  }

  const raw = input.files[officialFile];

  const counts: Record<string, number> = Object.fromEntries(
    ABSTAIN_TYPES.map((t) => [t, 0]),
  );
  let lineNo = 0;
  let abstainTotal = 0;
  for (const line of raw.split("\n")) {
    lineNo++;
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      errors.push(`${officialFile}:${lineNo}: invalid JSON`);
      continue;
    }
    if (obj["must_abstain"] !== true) continue;
    abstainTotal++;
    const t = obj["abstain_type"];
    if (typeof t !== "string" || !(ABSTAIN_TYPES as readonly string[]).includes(t)) {
      errors.push(
        `${officialFile}:${lineNo}: must_abstain topic with invalid abstain_type ${JSON.stringify(t)}`,
      );
      continue;
    }
    counts[t]++;
  }

  for (const t of ABSTAIN_TYPES) {
    const n = counts[t];
    if (n >= MIN_PER_TYPE) continue;
    errors.push(
      `${officialFile}: abstention subtype "${t}" has ${n} topics (minimum ${MIN_PER_TYPE}). The gold set must cover all three abstention behaviours. There is no waiver — fix the gold set.`,
    );
  }

  if (abstainTotal === 0) {
    errors.push(`${officialFile}: contains no must_abstain topics at all.`);
  }

  return { errors, warnings, officialFile, counts };
}

function driftGuard(): string[] {
  const errors: string[] = [];
  let src: string;
  try {
    src = readFileSync(STORE_SRC, "utf8");
  } catch {
    return [`Drift guard: cannot read ${STORE_SRC}`];
  }
  const m = src.match(/ABSTAIN_TYPES\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!m) return [`Drift guard: ABSTAIN_TYPES set not found in eval store source`];
  const storeTypes = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
  const ours = [...ABSTAIN_TYPES].sort();
  if (JSON.stringify(storeTypes) !== JSON.stringify(ours)) {
    errors.push(
      `Drift guard: eval store ABSTAIN_TYPES {${storeTypes.join(", ")}} differ from this validator's {${ours.join(", ")}} — update both together.`,
    );
  }
  return errors;
}

function positiveControls(realFiles: Record<string, string>, realExpectedVersion: string): string[] {
  const failures: string[] = [];
  const officialName = "gold-topics-v9.9.jsonl";
  const PIN = "9.9";
  const mk = (types: Partial<Record<AbstainType, number>>): string => {
    const lines: string[] = [];
    let i = 0;
    for (const [t, n] of Object.entries(types)) {
      for (let k = 0; k < (n as number); k++) {
        lines.push(
          JSON.stringify({
            topic_id: `pc-${t}-${++i}`,
            question: "x",
            question_type: "abstention",
            must_abstain: true,
            abstain_type: t,
          }),
        );
      }
    }
    return lines.join("\n") + "\n";
  };
  const full = mk({ out_of_corpus: 6, false_premise: 6, underspecified_homonym: 6 });

  // Control 0: a fully covered synthetic gold set must PASS.
  if (checkGold({ files: { [officialName]: full }, expectedVersion: PIN }).errors.length !== 0) {
    failures.push("control 0: fully covered synthetic gold set unexpectedly failed");
  }

  // Control 1: one type entirely missing must FAIL.
  const missing = mk({ out_of_corpus: 6, false_premise: 6 });
  const r1 = checkGold({ files: { [officialName]: missing }, expectedVersion: PIN });
  if (!r1.errors.some((e) => e.includes('"underspecified_homonym"'))) {
    failures.push("control 1: missing subtype was NOT flagged");
  }

  // Control 2: a type below threshold must FAIL.
  const low = mk({ out_of_corpus: 6, false_premise: 6, underspecified_homonym: 2 });
  const r2 = checkGold({ files: { [officialName]: low }, expectedVersion: PIN });
  if (!r2.errors.some((e) => e.includes('"underspecified_homonym"') && e.includes("2 topics"))) {
    failures.push("control 2: below-threshold subtype was NOT flagged");
  }

  // Control 3: an incomplete gold set (v0.2-style, out_of_corpus only) must
  // FAIL OUTRIGHT with hard errors and no warnings-only escape hatch — the
  // historical waiver is retired, so nothing may downgrade this to a warning.
  const v02Style = mk({ out_of_corpus: 25 });
  const r3 = checkGold({ files: { [officialName]: v02Style }, expectedVersion: PIN });
  const missingTypes: AbstainType[] = ["false_premise", "underspecified_homonym"];
  if (!missingTypes.every((t) => r3.errors.some((e) => e.includes(`"${t}"`)))) {
    failures.push("control 3: v0.2-style incomplete gold set did not hard-fail on both missing subtypes");
  }
  if (r3.warnings.length > 0) {
    failures.push("control 3b: incomplete gold set produced warnings — a waiver-like escape hatch survived");
  }

  // Control 4: draft files must never satisfy the requirement.
  const r4 = checkGold({
    files: {
      [officialName]: missing,
      "draft-abstain-extra.jsonl": mk({ underspecified_homonym: 10 }),
    },
    expectedVersion: PIN,
  });
  if (!r4.errors.some((e) => e.includes('"underspecified_homonym"'))) {
    failures.push("control 4: a draft file was allowed to satisfy the requirement");
  }
  if (r4.officialFile !== officialName) {
    failures.push("control 4b: official-file selection picked a draft");
  }

  // Control 6: deleting/down-versioning the newest gold file must FAIL with
  // a message naming the expected version — the older file must never
  // silently become the official set.
  const r6 = checkGold({
    files: { "gold-topics-v9.8.jsonl": full },
    expectedVersion: PIN,
  });
  if (!r6.errors.some((e) => e.includes("v9.9") && e.includes("v9.8") && e.includes("CURRENT_VERSION"))) {
    failures.push(
      "control 6: down-versioned gold pick was NOT flagged against the CURRENT_VERSION pin",
    );
  }

  // Control 7: double-digit minors must sort numerically (v0.10 > v0.9),
  // and the pin must accept the numerically-highest pick.
  const r7 = checkGold({
    files: {
      "gold-topics-v0.9.jsonl": mk({ out_of_corpus: 6 }),
      "gold-topics-v0.10.jsonl": full,
    },
    expectedVersion: "0.10",
  });
  if (r7.officialFile !== "gold-topics-v0.10.jsonl") {
    failures.push(
      `control 7: version sort picked ${r7.officialFile} instead of gold-topics-v0.10.jsonl (v0.10 must sort above v0.9)`,
    );
  }
  if (r7.errors.length !== 0) {
    failures.push("control 7b: v0.10 pick with matching pin unexpectedly failed");
  }

  // Control 8: a malformed CURRENT_VERSION pin must FAIL (no silent bypass).
  const r8 = checkGold({ files: { [officialName]: full }, expectedVersion: "garbage" });
  if (!r8.errors.some((e) => e.includes("malformed"))) {
    failures.push("control 8: malformed CURRENT_VERSION pin was NOT flagged");
  }

  // Control 5: the REAL official gold set must pass with zero warnings —
  // with the waiver machinery retired there is no legitimate warning path,
  // so any warning means an escape hatch crept back in.
  const r5 = checkGold({ files: realFiles, expectedVersion: realExpectedVersion });
  if (r5.warnings.length > 0) {
    failures.push(`control 5: real gold run emitted warnings (none expected post-waiver): ${r5.warnings.join(" | ")}`);
  }

  return failures;
}

function main(): void {
  let failed = false;

  const files: Record<string, string> = {};
  for (const f of readdirSync(GOLD_DIR)) {
    if (f.endsWith(".jsonl")) files[f] = readFileSync(path.join(GOLD_DIR, f), "utf8");
  }

  let expectedVersion: string;
  try {
    expectedVersion = readFileSync(path.join(GOLD_DIR, "CURRENT_VERSION"), "utf8").trim();
  } catch {
    console.error(
      `ERROR: ${path.join(GOLD_DIR, "CURRENT_VERSION")} is missing — it pins the expected official gold version and must exist.`,
    );
    console.error("validate-gold-abstain: FAILED");
    process.exit(1);
  }

  const controls = positiveControls(files, expectedVersion);
  if (controls.length > 0) {
    failed = true;
    console.error("POSITIVE CONTROLS FAILED (validator cannot be trusted):");
    for (const c of controls) console.error("  - " + c);
  } else {
    console.log("Positive controls: 9/9 seeded scenarios behaved correctly (incl. version-pin & v0.10>v0.9 sort).");
  }

  const drift = driftGuard();
  if (drift.length > 0) {
    failed = true;
    for (const e of drift) console.error("ERROR: " + e);
  }

  const res = checkGold({ files, expectedVersion });
  if (res.officialFile && res.counts) {
    console.log(
      `Official gold set: ${res.officialFile} — abstention counts: ${ABSTAIN_TYPES.map((t) => `${t}=${res.counts![t]}`).join(", ")} (min ${MIN_PER_TYPE} each)`,
    );
  }
  for (const w of res.warnings) console.warn("WARNING: " + w);
  for (const e of res.errors) console.error("ERROR: " + e);
  if (res.errors.length > 0) failed = true;

  if (failed) {
    console.error("validate-gold-abstain: FAILED");
    process.exit(1);
  }
  console.log("validate-gold-abstain: PASSED");
}

main();

export {};
