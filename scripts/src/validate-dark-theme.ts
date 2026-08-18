/**
 * Guards the Laertius dark theme against drifting back to plain gray.
 *
 * Task 573 deliberately recolored dark mode from zero-saturation neutral
 * grays to a deep blue-slate palette. A future edit to the `.dark` token
 * block in artifacts/laertius/src/index.css could silently reintroduce
 * desaturated grays (e.g. `220 0% 8%` or `0 0% 10%`) or wander out of
 * the cool-blue hue family, undoing the branded look with no failing
 * check.
 *
 * This validator parses the `.dark { ... }` block and asserts that every
 * core surface token:
 *   background, card, popover, border, input,
 *   card-border, popover-border, secondary, muted, accent
 * (1) parses as a bare `H S% L%` HSL triple,
 * (2) keeps saturation strictly above 0% (with a small floor so a
 *     near-gray 1% doesn't sneak by), and
 * (3) stays inside the cool-blue hue family (200°..250°).
 *
 * Positive counts are printed so a vacuous pass (block not found, tokens
 * renamed away) is impossible: every expected token must be present.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-dark-theme
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const CSS_PATH = path.resolve(
  import.meta.dirname,
  "../../artifacts/laertius/src/index.css",
);

// Core surface tokens that define the blue-slate look. Foreground/text
// tokens and semantic colors (destructive, certainty scale) are exempt:
// they legitimately live in other hue families.
const SURFACE_TOKENS = [
  "background",
  "card",
  "popover",
  "border",
  "input",
  "card-border",
  "popover-border",
  "secondary",
  "muted",
  "accent",
] as const;

// Cool-blue hue family (degrees) and minimum saturation (percent).
const HUE_MIN = 200;
const HUE_MAX = 250;
const SAT_MIN = 10;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

const css = readFileSync(CSS_PATH, "utf8");

// Extract the `.dark { ... }` token block (the first one — the token
// declarations; later `.dark .something` rules have a descendant part
// and never match `.dark` followed directly by `{`).
const darkMatch = css.match(/(^|\n)\.dark\s*\{([\s\S]*?)\}/);
check(".dark token block found in index.css", !!darkMatch);
const darkBlock = darkMatch?.[2] ?? "";

// Parse `--name: <value>;` declarations inside the block.
const decls = new Map<string, string>();
for (const m of darkBlock.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  decls.set(m[1]!, m[2]!.trim());
}
console.log(
  `Parsed ${decls.size} custom-property declarations in the .dark block`,
);
check(
  "positive control: the .dark block declares at least 15 tokens",
  decls.size >= 15,
  `found ${decls.size}`,
);

function parseHslTriple(
  value: string,
): { h: number; s: number; l: number } | null {
  const m = value.match(
    /^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/,
  );
  if (!m) return null;
  return { h: parseFloat(m[1]!), s: parseFloat(m[2]!), l: parseFloat(m[3]!) };
}

console.log(
  `\nChecking ${SURFACE_TOKENS.length} core surface tokens: hue ${HUE_MIN}..${HUE_MAX}, saturation >= ${SAT_MIN}%`,
);
for (const token of SURFACE_TOKENS) {
  const raw = decls.get(token);
  if (raw === undefined) {
    check(`--${token} is declared in the .dark block`, false, "missing");
    continue;
  }
  const hsl = parseHslTriple(raw);
  if (!hsl) {
    check(
      `--${token} parses as a bare "H S% L%" triple`,
      false,
      `value: "${raw}"`,
    );
    continue;
  }
  // Normalize hue into [0, 360).
  const hue = ((hsl.h % 360) + 360) % 360;
  check(
    `--${token} keeps saturation (${hsl.s}% >= ${SAT_MIN}%)`,
    hsl.s >= SAT_MIN,
    `"${raw}" is (near-)gray — the blue-slate palette must not drop to neutral`,
  );
  if (hsl.s >= SAT_MIN) {
    check(
      `--${token} stays in the cool-blue hue family (${hue} in ${HUE_MIN}..${HUE_MAX})`,
      hue >= HUE_MIN && hue <= HUE_MAX,
      `"${raw}" left the blue-slate family`,
    );
  }
}

if (failures > 0) {
  console.error(`\nvalidate-dark-theme: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-dark-theme: all checks passed");
