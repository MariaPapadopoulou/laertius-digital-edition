/**
 * Guards the store-health pill against silently ignoring failures of a
 * newly generated Legomena GET (query) hook.
 *
 * Query failures are routed through App.tsx's QueryCache onError handler,
 * which matches queryKey[0] — a client-side string that exists even when
 * fetch throws before any response (network-level failure) — against the
 * hardcoded LEGOMENA_QUERY_PREFIX. So GET failures cannot escape the pill
 * as long as EVERY generated query key actually starts with that prefix.
 * If codegen's base path drifts (e.g. the OpenAPI spec's server URL
 * changes) or a hook's key shape changes, a new GET endpoint could fail
 * without ever flipping the pill.
 *
 * This validator:
 * 1. Extracts every `export const get*QueryKey = ... return [ <path> ...]`
 *    first-element path literal from the generated
 *    lib/api-client-react/src/generated-legomena/legomena.ts.
 * 2. Extracts LEGOMENA_QUERY_PREFIX from artifacts/laertius/src/App.tsx.
 * 3. Fails if any generated query-key path does not start with the prefix
 *    (its failures would never flip the pill).
 * 4. Scans every laertius source file that imports the generated Legomena
 *    client for a consumer-supplied `queryKey:` override — a custom key
 *    (e.g. `queryKey: ["legomena", "entity", uri]`) bypasses the prefix
 *    check in App.tsx entirely, so the pill would never flip on that GET's
 *    failures. Overrides are rejected unless they are built from a
 *    generated `get*QueryKey(...)` getter.
 * 5. Positive controls: fails if zero query-key getters are found, if the
 *    prefix cannot be located/parsed, if the health-check key (the one
 *    App.tsx deliberately excludes) is not among the extracted paths, or
 *    if the override scanner fails to flag a seeded bad override — each
 *    of those would make a green run vacuous.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-legomena-query-keys
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const generatedPath = path.join(
  root,
  "lib/api-client-react/src/generated-legomena/legomena.ts",
);
const appPath = path.join(root, "artifacts/laertius/src/App.tsx");

const errors: string[] = [];

// 1. Query-key path literals from the generated client. Each getter looks
// like:
//   export const getXQueryKey = (…) => {
//       return [
//       `/legomena/api/whatever${id}`, ...(params ? [params] : [])
//       ] as const;
//       }
// We take the FIRST element of the returned array — that is what App.tsx's
// QueryCache handler inspects (queryKey[0]).
const generated = readFileSync(generatedPath, "utf8");
const keyPaths = new Map<string, string>(); // getter name -> first-element path
for (const m of generated.matchAll(
  /export\s+const\s+(get\w*QueryKey)\s*=[^]*?return\s*\[\s*(['"`])((?:\\.|(?!\2).)*)\2/g,
)) {
  keyPaths.set(m[1]!, m[3]!);
}

// Positive control A: extraction must find something.
if (keyPaths.size === 0) {
  errors.push(
    `positive control failed: found ZERO \`get*QueryKey\` getters in ${path.relative(root, generatedPath)} — the generated file layout may have changed; update this validator's extraction regex.`,
  );
}

// 2. LEGOMENA_QUERY_PREFIX in App.tsx.
const app = readFileSync(appPath, "utf8");
const prefixMatch = app.match(
  /LEGOMENA_QUERY_PREFIX\s*=\s*(['"`])((?:\\.|(?!\1).)*)\1/,
);
const prefix = prefixMatch?.[2];
if (!prefix) {
  errors.push(
    `could not locate \`LEGOMENA_QUERY_PREFIX = "..."\` in ${path.relative(root, appPath)} — if it was renamed or restructured, update this validator.`,
  );
} else if (prefix.length === 0) {
  errors.push(
    "LEGOMENA_QUERY_PREFIX parsed but is an empty string — an empty prefix matches everything and the pill check is meaningless.",
  );
}

// Positive control B: the health-check key (the one query App.tsx
// deliberately EXCLUDES from re-check) must be among the extracted paths.
// If it is missing, our extraction is not seeing real query keys.
const healthGetter = "getHealthCheckQueryKey";
if (keyPaths.size > 0 && !keyPaths.has(healthGetter)) {
  errors.push(
    `positive control failed: ${healthGetter} was not extracted from the generated client — extraction regex is likely broken.`,
  );
}

// 3. Every generated query-key path must start with the prefix.
if (prefix) {
  for (const [getter, keyPath] of [...keyPaths.entries()].sort()) {
    if (!keyPath.startsWith(prefix)) {
      errors.push(
        `generated query key ${getter} starts with "${keyPath}" which does NOT begin with LEGOMENA_QUERY_PREFIX ("${prefix}") from artifacts/laertius/src/App.tsx — failures of this GET endpoint will never flip the store pill. Align the prefix or the codegen base path.`,
      );
    }
  }
}

// 4. Consumer-side overrides: any file importing the Legomena client must
// not pass a hand-rolled queryKey. A literal-array override never goes
// through LEGOMENA_QUERY_PREFIX matching, so its failures skip the pill.
import { readdirSync, statSync } from "node:fs";

const laertiusSrc = path.join(root, "artifacts/laertius/src");
function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?)$/.test(name)) yield p;
  }
}

/** Returns the offending override snippets found in one file's source. */
function findBadOverrides(source: string): string[] {
  if (!/@workspace\/api-client-react\/legomena/.test(source)) return [];
  const bad: string[] = [];
  for (const m of source.matchAll(/queryKey\s*:\s*([^,}\n]+)/g)) {
    const value = m[1]!.trim();
    // Allowed: keys built from a generated getter, e.g.
    //   queryKey: getGetEntityQueryKey(params)
    //   queryKey: getHealthCheckQueryKey()
    if (/^get\w*QueryKey\s*\(/.test(value)) continue;
    bad.push(value);
  }
  return bad;
}

for (const file of walk(laertiusSrc)) {
  for (const snippet of findBadOverrides(readFileSync(file, "utf8"))) {
    errors.push(
      `custom Legomena queryKey override in ${path.relative(root, file)}: \`queryKey: ${snippet}\` — a hand-rolled key bypasses App.tsx's LEGOMENA_QUERY_PREFIX check, so this GET's failures never flip the store pill. Use the generated get*QueryKey getter (or drop the override).`,
    );
  }
}

// Positive control C: the override scanner must flag a seeded bad override
// and must accept a generated-getter override.
const seededBad = `import { useGetEntity } from "@workspace/api-client-react/legomena";
useGetEntity({ uri }, { query: { queryKey: ["legomena", "entity", uri] } });`;
if (findBadOverrides(seededBad).length !== 1) {
  errors.push(
    "positive control failed: override scanner did not flag a seeded hand-rolled queryKey override — the scan regex is broken.",
  );
}
const seededGood = `import { useGetEntity, getGetEntityQueryKey } from "@workspace/api-client-react/legomena";
useGetEntity({ uri }, { query: { queryKey: getGetEntityQueryKey({ uri }) } });`;
if (findBadOverrides(seededGood).length !== 0) {
  errors.push(
    "positive control failed: override scanner flagged a generated-getter override — the allowlist regex is broken.",
  );
}

console.log(
  `generated query-key getters (${keyPaths.size}):\n${[...keyPaths.entries()]
    .sort()
    .map(([g, p]) => `  ${g} -> ${p}`)
    .join("\n") || "  (none)"}`,
);
console.log(`App.tsx LEGOMENA_QUERY_PREFIX: ${prefix ?? "(not found)"}`);

if (errors.length > 0) {
  console.error(`\nvalidate-legomena-query-keys FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("validate-legomena-query-keys: OK");
