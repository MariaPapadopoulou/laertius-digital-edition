/**
 * Stops the two namespace prefix maps from drifting apart unnoticed.
 *
 * The frontend's SPARQL_PREFIXES (artifacts/laertius/src/lib/sparql-prefixes.ts,
 * playground autocomplete) and the server's TURTLE_PREFIXES
 * (artifacts/api-server/src/lib/turtle-compact.ts, .ttl download compaction)
 * must agree entry-by-entry: a prefix added, removed, or re-pointed on one
 * side means autocomplete and downloaded Turtle silently disagree about what
 * e.g. `crm:` expands to.
 *
 * This validator diffs the two maps and fails on any missing, extra, or
 * mismatched entry. A positive control mutates a copy of one map (rename a
 * URI, drop a key, add a key) and asserts the diff logic reports each
 * mutation — so a vacuous comparison can't pass.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-prefix-drift
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { SPARQL_PREFIXES } = await import(
  "../../artifacts/laertius/src/lib/sparql-prefixes"
);
const { TURTLE_PREFIXES } = await import(
  "../../artifacts/api-server/src/lib/turtle-compact"
);

/** Entry-by-entry diff of two prefix maps; returns human-readable mismatches. */
function diffPrefixMaps(
  frontend: Record<string, string>,
  server: Record<string, string>,
): string[] {
  const problems: string[] = [];
  for (const [prefix, uri] of Object.entries(frontend)) {
    if (!(prefix in server)) {
      problems.push(
        `prefix "${prefix}:" exists in the frontend map but is missing from the server's TURTLE_PREFIXES`,
      );
    } else if (server[prefix] !== uri) {
      problems.push(
        `prefix "${prefix}:" points to <${uri}> in the frontend but <${server[prefix]}> on the server`,
      );
    }
  }
  for (const prefix of Object.keys(server)) {
    if (!(prefix in frontend)) {
      problems.push(
        `prefix "${prefix}:" exists in the server's TURTLE_PREFIXES but is missing from the frontend map`,
      );
    }
  }
  return problems;
}

const errors: string[] = [];

// Vacuity guard: an empty map on either side would make agreement meaningless.
const frontendCount = Object.keys(SPARQL_PREFIXES).length;
const serverCount = Object.keys(TURTLE_PREFIXES).length;
if (frontendCount === 0) {
  errors.push("frontend SPARQL_PREFIXES is empty — the comparison is vacuous");
}
if (serverCount === 0) {
  errors.push("server TURTLE_PREFIXES is empty — the comparison is vacuous");
}

// Positive controls: prove the diff fires for each mutation class.
{
  const mutated: Record<string, string> = { ...SPARQL_PREFIXES };
  const firstKey = Object.keys(mutated)[0];
  if (firstKey === undefined) {
    errors.push("positive control skipped: no prefixes to mutate");
  } else {
    // 1. Re-pointed URI
    const repointed = { ...mutated, [firstKey]: "https://example.org/DRIFT#" };
    if (
      !diffPrefixMaps(repointed, TURTLE_PREFIXES).some((p) =>
        p.includes(firstKey),
      )
    ) {
      errors.push(
        `positive control failed: re-pointing "${firstKey}:" was not detected`,
      );
    }
    // 2. Dropped key
    const dropped = { ...mutated };
    delete dropped[firstKey];
    if (
      !diffPrefixMaps(dropped, TURTLE_PREFIXES).some(
        (p) => p.includes(firstKey) && p.includes("missing from the frontend"),
      )
    ) {
      errors.push(
        `positive control failed: dropping "${firstKey}:" from the frontend was not detected`,
      );
    }
    // 3. Extra key
    const added = { ...mutated, zzdrift: "https://example.org/zzdrift#" };
    if (
      !diffPrefixMaps(added, TURTLE_PREFIXES).some(
        (p) => p.includes("zzdrift") && p.includes("missing from the server"),
      )
    ) {
      errors.push(
        'positive control failed: an extra frontend prefix "zzdrift:" was not detected',
      );
    }
  }
}

// The real comparison.
const drift = diffPrefixMaps(SPARQL_PREFIXES, TURTLE_PREFIXES);
errors.push(...drift);

if (errors.length > 0) {
  console.error("validate-prefix-drift FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-prefix-drift OK: frontend SPARQL_PREFIXES and server TURTLE_PREFIXES agree on all ${frontendCount} entries (positive controls: re-point, drop, and add mutations each detected)`,
);
