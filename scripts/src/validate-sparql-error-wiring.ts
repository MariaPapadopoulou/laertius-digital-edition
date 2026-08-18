/**
 * validate-sparql-error-wiring — proves the SPARQL playground's friendly
 * error messages really come from the SAME helper the 413-message validator
 * checks.
 *
 * validate-sparql-413-message proves friendlyErrorMessage
 * (artifacts/laertius/src/lib/sparql-error-message.ts) produces readable
 * messages for 413/400/etc. But that proof is only meaningful while the
 * component actually calls that module: if a refactor of
 * sparql-playground.tsx inlined its own error formatting (or shadowed the
 * name with a local copy), the 413 validator would keep passing while users
 * saw raw server errors again.
 *
 * This check parses the component with the TypeScript AST and asserts:
 *  1. friendlyErrorMessage is imported (as a named import, not renamed) from
 *     the ../lib/sparql-error-message module — the exact module the 413
 *     validator imports.
 *  2. Nothing in the component file re-declares/shadows friendlyErrorMessage.
 *  3. Both error paths call the imported helper:
 *     - fetchTurtle() (the .ttl download path) calls friendlyErrorMessage
 *       inside its non-ok response handling, and
 *     - the run useCallback inside SparqlPlayground calls it for failed
 *       responses.
 *
 * Negative controls: the same checker is re-run against in-memory mutants of
 * the real source (deleted import, local shadowing copy, run()'s call
 * replaced with inline formatting, fetchTurtle's call replaced with inline
 * formatting) and must flag each one, so the check cannot pass vacuously.
 *
 * Run: pnpm --filter @workspace/scripts run validate-sparql-error-wiring
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

const COMPONENT_PATH = path.join(
  repoRoot,
  "artifacts/laertius/src/components/sparql-playground.tsx",
);
const HELPER_MODULE_SUFFIX = "lib/sparql-error-message";
const HELPER_NAME = "friendlyErrorMessage";

/** Returns the list of wiring violations found in the given source text. */
function checkWiring(sourceText: string): string[] {
  const errors: string[] = [];
  const sf = ts.createSourceFile(
    "sparql-playground.tsx",
    sourceText,
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  // 1. Named, un-renamed import of friendlyErrorMessage from the helper module.
  let importedFromHelperModule = false;
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text.replace(/\.tsx?$/, "");
    if (!spec.endsWith(HELPER_MODULE_SUFFIX)) continue;
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        if (el.name.text === HELPER_NAME && !el.propertyName) {
          importedFromHelperModule = true;
        }
      }
    }
  }
  if (!importedFromHelperModule) {
    errors.push(
      `no named import of ${HELPER_NAME} from a module ending in "${HELPER_MODULE_SUFFIX}" — the component is no longer wired to the helper the 413-message validator checks`,
    );
  }

  // 2. No local declaration shadowing the helper name.
  const visitForShadows = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) && node.name?.text === HELPER_NAME) ||
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === HELPER_NAME)
    ) {
      errors.push(
        `local ${ts.isFunctionDeclaration(node) ? "function" : "variable"} declaration of ${HELPER_NAME} shadows the imported helper — error paths could silently use a diverging local copy`,
      );
    }
    ts.forEachChild(node, visitForShadows);
  };
  visitForShadows(sf);

  const callsHelper = (root: ts.Node): boolean => {
    let found = false;
    const visit = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === HELPER_NAME
      ) {
        found = true;
      }
      ts.forEachChild(n, visit);
    };
    visit(root);
    return found;
  };

  // 3a. fetchTurtle (the .ttl download path) must call the helper.
  let fetchTurtleFn: ts.FunctionDeclaration | undefined;
  const findFetchTurtle = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "fetchTurtle") {
      fetchTurtleFn = node;
    }
    ts.forEachChild(node, findFetchTurtle);
  };
  findFetchTurtle(sf);
  if (!fetchTurtleFn || !fetchTurtleFn.body) {
    errors.push(
      `no function declaration named fetchTurtle found — the .ttl error path moved or was renamed, so this check can no longer see it`,
    );
  } else if (!callsHelper(fetchTurtleFn.body)) {
    errors.push(
      `fetchTurtle does not call ${HELPER_NAME} — the .ttl download's error path no longer produces messages from the validated helper`,
    );
  }

  // 3b. The run useCallback inside the playground component must call it too.
  let runInitializer: ts.Node | undefined;
  const findRun = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "run" &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "useCallback"
    ) {
      runInitializer = node.initializer;
    }
    ts.forEachChild(node, findRun);
  };
  findRun(sf);
  if (!runInitializer) {
    errors.push(
      `no "run" useCallback found — the query-run error path moved or was renamed, so this check can no longer see it`,
    );
  } else if (!callsHelper(runInitializer)) {
    errors.push(
      `the run useCallback does not call ${HELPER_NAME} — failed query responses no longer produce messages from the validated helper`,
    );
  }

  return errors;
}

// ---------------------------------------------------------------------------

const realSource = readFileSync(COMPONENT_PATH, "utf8");
const failures: string[] = [];

const realErrors = checkWiring(realSource);
for (const e of realErrors) failures.push(`wiring check: ${e}`);

// Negative controls: mutate the real source and require the checker to fail.
interface Mutant {
  name: string;
  mutate: (src: string) => string;
}
const mutants: Mutant[] = [
  {
    name: "import of friendlyErrorMessage removed",
    mutate: (src) =>
      src
        .replace(/import\s*\{\s*friendlyErrorMessage\s*\}\s*from\s*"[^"]*";\n/, "")
        .replace(/export\s*\{\s*friendlyErrorMessage\s*\};\n/, ""),
  },
  {
    name: "local shadowing copy of friendlyErrorMessage",
    mutate: (src) =>
      src.replace(
        /import\s*\{\s*friendlyErrorMessage\s*\}\s*from\s*"[^"]*";\n/,
        'async function friendlyErrorMessage(res: { status: number }): Promise<string> { return `Error ${res.status}`; }\n',
      ),
  },
  {
    name: "run()'s call replaced with inline formatting",
    mutate: (src) =>
      src.replace(
        /setError\(await friendlyErrorMessage\(res\)\);/,
        "setError(`Request failed (${res.status})`);",
      ),
  },
  {
    name: "fetchTurtle's call replaced with inline formatting",
    mutate: (src) =>
      src.replace(
        /throw new Error\(await friendlyErrorMessage\(res\)\);/,
        "throw new Error(`Request failed (${res.status})`);",
      ),
  },
];

for (const m of mutants) {
  const mutated = m.mutate(realSource);
  if (mutated === realSource) {
    failures.push(
      `negative control "${m.name}": mutation did not change the source — the component's shape drifted and this control went vacuous; update the mutation`,
    );
    continue;
  }
  const errs = checkWiring(mutated);
  if (errs.length === 0) {
    failures.push(
      `negative control "${m.name}": checker passed a deliberately broken source — the check would not catch this drift`,
    );
  }
}

if (failures.length > 0) {
  console.error("validate-sparql-error-wiring FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `validate-sparql-error-wiring OK: fetchTurtle and the run useCallback both call ${HELPER_NAME} imported from ${HELPER_MODULE_SUFFIX}, no shadowing declarations, and all ${mutants.length} negative-control mutants were correctly rejected`,
);
