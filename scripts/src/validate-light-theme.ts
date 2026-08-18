/**
 * Guards the Laertius light theme against drifting away from the
 * crimson-and-white editorial palette.
 *
 * The light theme was deliberately moved from the old parchment-and-lapis
 * palette to the homepage's editorial style: pure white background,
 * Harvard crimson (#8B1A1A ≈ hsl(0 68% 32%)) primary, Playfair Display
 * display headings, and Source Serif 4 body serif. A future edit to the
 * `:root` token block in artifacts/laertius/src/index.css (or to the
 * Google Fonts <link> in index.html) could silently revert tokens or
 * fonts and split the homepage's look from the inner pages again.
 *
 * This validator asserts:
 *   - :root --background is pure white (0 0% 100%)
 *   - :root --primary is the crimson hue (0 68% 32%)
 *   - :root --app-font-serif starts with 'Source Serif 4'
 *   - :root --app-font-display starts with 'Playfair Display'
 *   - index.html loads a Google Fonts stylesheet including both
 *     Playfair Display and Source Serif 4 families
 *
 * Positive counts are printed so a vacuous pass (block not found, tokens
 * renamed away) is impossible: every expected token must be present.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-light-theme
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const CSS_PATH = path.resolve(
  import.meta.dirname,
  "../../artifacts/laertius/src/index.css",
);
const HTML_PATH = path.resolve(
  import.meta.dirname,
  "../../artifacts/laertius/index.html",
);

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

// Extract the `:root { ... }` token block.
const rootMatch = css.match(/(^|\n):root\s*\{([\s\S]*?)\}/);
check(":root token block found in index.css", !!rootMatch);
const rootBlock = rootMatch?.[2] ?? "";

// Parse `--name: <value>;` declarations inside the block.
const decls = new Map<string, string>();
for (const m of rootBlock.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  decls.set(m[1]!, m[2]!.trim());
}
console.log(
  `Parsed ${decls.size} custom-property declarations in the :root block`,
);
check(
  "positive control: the :root block declares at least 15 tokens",
  decls.size >= 15,
  `found ${decls.size}`,
);

function normTriple(value: string | undefined): string | null {
  if (value === undefined) return null;
  const m = value.match(
    /^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/,
  );
  if (!m) return null;
  return `${parseFloat(m[1]!)} ${parseFloat(m[2]!)}% ${parseFloat(m[3]!)}%`;
}

// 1. Pure white background.
const bg = decls.get("background");
check(
  "--background is pure white (0 0% 100%)",
  normTriple(bg) === "0 0% 100%",
  `value: "${bg ?? "missing"}"`,
);

// 2. Harvard crimson primary.
const primary = decls.get("primary");
check(
  "--primary is the Harvard crimson hue (0 68% 32%)",
  normTriple(primary) === "0 68% 32%",
  `value: "${primary ?? "missing"}"`,
);

// 2b. Ring follows the crimson primary.
const ring = decls.get("ring");
check(
  "--ring matches the crimson primary (0 68% 32%)",
  normTriple(ring) === "0 68% 32%",
  `value: "${ring ?? "missing"}"`,
);

// 3. Body serif stack leads with Source Serif 4.
const serif = decls.get("app-font-serif");
check(
  "--app-font-serif starts with 'Source Serif 4'",
  /^['"]Source Serif 4['"]/.test(serif ?? ""),
  `value: "${serif ?? "missing"}"`,
);

// 4. Display stack leads with Playfair Display.
const display = decls.get("app-font-display");
check(
  "--app-font-display starts with 'Playfair Display'",
  /^['"]Playfair Display['"]/.test(display ?? ""),
  `value: "${display ?? "missing"}"`,
);

// 5. Warm surface tokens stay in family and keep their saturation.
//
// The editorial palette keeps hairline warm borders and warm-tinted
// secondary/muted/accent surfaces; an edit could silently drop them to
// 0% saturation (plain white-gray) with no failing check. Each token is
// pinned to its warm hue band with a saturation floor. Pure-white
// surfaces (background, popover) are legitimately 0 0% 100% and exempt
// (background is already pinned exactly above).
function parseHsl(
  value: string | undefined,
): { h: number; s: number; l: number } | null {
  if (value === undefined) return null;
  const m = value.match(
    /^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/,
  );
  if (!m) return null;
  const h = ((parseFloat(m[1]!) % 360) + 360) % 360;
  return { h, s: parseFloat(m[2]!), l: parseFloat(m[3]!) };
}

const WARM_SURFACE_TOKENS: {
  token: string;
  hueMin: number;
  hueMax: number;
  satMin: number;
}[] = [
  // Hairline warm-gray borders (~36°).
  { token: "border", hueMin: 25, hueMax: 50, satMin: 5 },
  { token: "input", hueMin: 25, hueMax: 50, satMin: 5 },
  { token: "card-border", hueMin: 25, hueMax: 50, satMin: 5 },
  { token: "popover-border", hueMin: 25, hueMax: 50, satMin: 5 },
  // Warm off-white card ground (~30°).
  { token: "card", hueMin: 20, hueMax: 50, satMin: 5 },
  // Warm cream secondary/muted surfaces (~45°).
  { token: "secondary", hueMin: 35, hueMax: 55, satMin: 5 },
  { token: "muted", hueMin: 35, hueMax: 55, satMin: 5 },
  // Crimson-tinted accent wash (~7°, near the primary hue).
  { token: "accent", hueMin: 0, hueMax: 20, satMin: 5 },
];
console.log(
  `\nChecking ${WARM_SURFACE_TOKENS.length} warm surface tokens (hue in family, saturation above floor)`,
);
for (const { token, hueMin, hueMax, satMin } of WARM_SURFACE_TOKENS) {
  const raw = decls.get(token);
  const hsl = parseHsl(raw);
  if (!hsl) {
    check(
      `--${token} parses as a bare "H S% L%" triple`,
      false,
      `value: "${raw ?? "missing"}"`,
    );
    continue;
  }
  check(
    `--${token} keeps saturation (${hsl.s}% >= ${satMin}%)`,
    hsl.s >= satMin,
    `"${raw}" is (near-)gray — the warm surfaces must not drop to neutral`,
  );
  if (hsl.s >= satMin) {
    check(
      `--${token} stays in its warm hue band (${hsl.h} in ${hueMin}..${hueMax})`,
      hsl.h >= hueMin && hsl.h <= hueMax,
      `"${raw}" left the warm family`,
    );
  }
}

// 6. Both display/serif families load self-hosted via fontsource imports in
//    index.css (the Google Fonts CDN link was deliberately removed so the
//    whole site shares one loading path), and no CDN link creeps back in.
const html = readFileSync(HTML_PATH, "utf8");
check(
  "index.html has no Google Fonts stylesheet link (fonts are self-hosted)",
  !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html),
  "a Google Fonts CDN reference reappeared in index.html",
);
check(
  "index.css imports @fontsource/playfair-display",
  /@import\s+"@fontsource\/playfair-display\//.test(css),
  "no @fontsource/playfair-display import found in index.css",
);
check(
  "index.css imports @fontsource/source-serif-4",
  /@import\s+"@fontsource\/source-serif-4\//.test(css),
  "no @fontsource/source-serif-4 import found in index.css",
);

if (failures > 0) {
  console.error(`\nvalidate-light-theme: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-light-theme: all checks passed");
