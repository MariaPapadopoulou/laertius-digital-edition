/**
 * validate-ttl-button-wiring — proves the SPARQL playground's ".ttl" download
 * button is really gated by the SAME isGraphQuery detector the drift
 * validator checks.
 *
 * validate-sparql-form-drift proves the client detector isGraphQuery
 * (artifacts/laertius/src/lib/sparql-query-form.ts) and the server's
 * queryForm agree on every shipped query. But that proof is only meaningful
 * while the component actually calls that module: if a refactor of
 * sparql-playground.tsx inlined its own regex (or shadowed the name with a
 * local copy), the drift validator would keep passing while the button
 * silently drifted from the server.
 *
 * This check parses the component with the TypeScript AST and asserts:
 *  1. isGraphQuery is imported (as a named import, not renamed) from the
 *     ../lib/sparql-query-form module — the exact module the drift validator
 *     imports.
 *  2. Nothing in the component file re-declares/shadows isGraphQuery.
 *  3. The "Run & download .ttl" button (data-testid="sparql-run-download-ttl")
 *     sits in the true branch of a conditional whose condition is a call to
 *     that imported isGraphQuery.
 *
 * Negative controls: the same checker is re-run against three in-memory
 * mutants of the real source (inlined regex condition, deleted import,
 * local shadowing copy) and must flag each one, so the check cannot pass
 * vacuously.
 *
 * Run: pnpm --filter @workspace/scripts run validate-ttl-button-wiring
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
const DETECTOR_MODULE_SUFFIX = "lib/sparql-query-form";
const BUTTON_TESTID = "sparql-run-download-ttl";
const DETECTOR_NAME = "isGraphQuery";

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

  // 1. Named, un-renamed import of isGraphQuery from the detector module.
  let importedFromDetectorModule = false;
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text.replace(/\.tsx?$/, "");
    if (!spec.endsWith(DETECTOR_MODULE_SUFFIX)) continue;
    const bindings = stmt.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        if (el.name.text === DETECTOR_NAME && !el.propertyName) {
          importedFromDetectorModule = true;
        }
      }
    }
  }
  if (!importedFromDetectorModule) {
    errors.push(
      `no named import of ${DETECTOR_NAME} from a module ending in "${DETECTOR_MODULE_SUFFIX}" — the component is no longer wired to the detector the drift validator checks`,
    );
  }

  // 2. No local declaration shadowing the detector name.
  const shadows: string[] = [];
  const visitForShadows = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) && node.name?.text === DETECTOR_NAME) ||
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === DETECTOR_NAME)
    ) {
      shadows.push(
        `local ${ts.isFunctionDeclaration(node) ? "function" : "variable"} declaration of ${DETECTOR_NAME}`,
      );
    }
    ts.forEachChild(node, visitForShadows);
  };
  visitForShadows(sf);
  for (const s of shadows) {
    errors.push(
      `${s} shadows the imported detector — the button could silently use a diverging local copy`,
    );
  }

  // 3. Find the button by data-testid and verify its gating conditional.
  let buttonNode: ts.JsxAttribute | undefined;
  const findButton = (node: ts.Node): void => {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "data-testid" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text === BUTTON_TESTID
    ) {
      buttonNode = node;
    }
    ts.forEachChild(node, findButton);
  };
  findButton(sf);

  if (!buttonNode) {
    errors.push(
      `no element with data-testid="${BUTTON_TESTID}" found — the .ttl download button (or its testid) is gone, so this check and the e2e can no longer see it`,
    );
    return errors;
  }

  const conditionCallsDetector = (cond: ts.Expression): boolean => {
    let found = false;
    const visit = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === DETECTOR_NAME
      ) {
        found = true;
      }
      ts.forEachChild(n, visit);
    };
    visit(cond);
    return found;
  };

  // Walk up from the button attribute looking for the nearest conditional
  // (ternary true-branch or `&&` right side) that shows/hides it.
  let gated = false;
  let sawConditional = false;
  for (let n: ts.Node | undefined = buttonNode; n; n = n.parent) {
    const p: ts.Node | undefined = n.parent;
    if (!p) break;
    if (ts.isConditionalExpression(p) && p.whenTrue === n) {
      sawConditional = true;
      if (conditionCallsDetector(p.condition)) gated = true;
      break;
    }
    if (
      ts.isBinaryExpression(p) &&
      p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      p.right === n
    ) {
      sawConditional = true;
      if (conditionCallsDetector(p.left)) gated = true;
      break;
    }
  }

  if (!sawConditional) {
    errors.push(
      `the ${BUTTON_TESTID} button is not inside any visibility conditional — it renders unconditionally instead of being gated by ${DETECTOR_NAME}`,
    );
  } else if (!gated) {
    errors.push(
      `the conditional gating the ${BUTTON_TESTID} button does not call ${DETECTOR_NAME} — the button's visibility has drifted from the validated detector`,
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
    name: "inlined regex replaces the isGraphQuery(query) gate",
    mutate: (src) =>
      src.replace(
        /isGraphQuery\(query\)\s*\?/,
        "/^\\s*(CONSTRUCT|DESCRIBE)/i.test(query) ?",
      ),
  },
  {
    name: "import of isGraphQuery removed",
    mutate: (src) =>
      src
        .replace(/import\s*\{\s*isGraphQuery\s*\}\s*from\s*"[^"]*";\n/, "")
        .replace(/export\s*\{\s*isGraphQuery\s*\};\n/, ""),
  },
  {
    name: "local shadowing copy of isGraphQuery",
    mutate: (src) =>
      src.replace(
        /import\s*\{\s*isGraphQuery\s*\}\s*from\s*"[^"]*";\n/,
        "function isGraphQuery(q: string): boolean { return /construct|describe/i.test(q); }\n",
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
  console.error("validate-ttl-button-wiring FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `validate-ttl-button-wiring OK: ${BUTTON_TESTID} is gated by ${DETECTOR_NAME} imported from ${DETECTOR_MODULE_SUFFIX}, no shadowing declarations, and all ${mutants.length} negative-control mutants were correctly rejected`,
);
