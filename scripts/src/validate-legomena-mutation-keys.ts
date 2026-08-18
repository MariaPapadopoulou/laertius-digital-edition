/**
 * Guards the store-health pill against silently ignoring failures of a
 * newly generated Legomena mutation. The pill re-checks health when any
 * Legomena request fails; for mutations this relies on a hardcoded
 * LEGOMENA_MUTATION_KEYS set in artifacts/laertius/src/App.tsx (network
 * failures carry no request URL). If codegen later adds a new POST
 * endpoint, its mutation key must be added there too — otherwise its
 * failures would never flip the pill.
 *
 * This validator:
 * 1. Extracts every `const mutationKey = [...]` entry from the generated
 *    lib/api-client-react/src/generated-legomena/legomena.ts.
 * 2. Extracts the LEGOMENA_MUTATION_KEYS set literal from App.tsx.
 * 3. Fails if any generated key is missing from the App.tsx set.
 * 4. Positive control: fails if zero mutation keys are found in the
 *    generated file (a vacuously green run is worthless), or if the
 *    App.tsx set cannot be located/parsed.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-legomena-mutation-keys
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

// 1. Mutation keys from the generated client.
const generated = readFileSync(generatedPath, "utf8");
const generatedKeys = new Set<string>();
for (const m of generated.matchAll(
  /const\s+mutationKey\s*=\s*\[([^\]]*)\]/g,
)) {
  for (const lit of m[1]!.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
    generatedKeys.add(lit[2]!);
  }
}

// Positive control: the extraction itself must find something.
if (generatedKeys.size === 0) {
  errors.push(
    `positive control failed: found ZERO \`const mutationKey = [...]\` entries in ${path.relative(root, generatedPath)} — the generated file layout may have changed; update this validator's extraction regex.`,
  );
}

// 2. LEGOMENA_MUTATION_KEYS set in App.tsx.
const app = readFileSync(appPath, "utf8");
const setMatch = app.match(
  /LEGOMENA_MUTATION_KEYS\s*=\s*new\s+Set(?:<[^>]*>)?\(\s*\[([^\]]*)\]\s*\)/,
);
const appKeys = new Set<string>();
if (!setMatch) {
  errors.push(
    `could not locate \`LEGOMENA_MUTATION_KEYS = new Set([...])\` in ${path.relative(root, appPath)} — if it was renamed or restructured, update this validator.`,
  );
} else {
  for (const lit of setMatch[1]!.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
    appKeys.add(lit[2]!);
  }
  if (appKeys.size === 0) {
    errors.push(
      "LEGOMENA_MUTATION_KEYS parsed but contains zero string keys — extraction or the set itself is broken.",
    );
  }
}

// 3. Every generated key must be present in the App.tsx set.
for (const key of [...generatedKeys].sort()) {
  if (!appKeys.has(key)) {
    errors.push(
      `generated mutation key "${key}" is missing from LEGOMENA_MUTATION_KEYS in artifacts/laertius/src/App.tsx — its failures will NOT flip the store pill. Add it to the set.`,
    );
  }
}

console.log(
  `generated mutation keys (${generatedKeys.size}): ${[...generatedKeys].sort().join(", ") || "(none)"}`,
);
console.log(
  `App.tsx LEGOMENA_MUTATION_KEYS (${appKeys.size}): ${[...appKeys].sort().join(", ") || "(none)"}`,
);

if (errors.length > 0) {
  console.error(`\nvalidate-legomena-mutation-keys FAILED (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("validate-legomena-mutation-keys: OK");
