/**
 * Shared contract between build-ionos-bundle.ts and check-bundle-freshness.ts.
 *
 * Everything that shapes the shipped bundle is declared here once, so the
 * freshness validator and the bundle build can never drift apart:
 *   - DATA_FILES: the corpus/data files the bundle ships (relative to
 *     artifacts/api-server/data/). TEI XMLs and cached models are deliberately
 *     not bundled, so they never make the zip stale.
 *   - sourceDirs: directories whose files are compiled or built into the
 *     bundle (api-server src, frontend src, bundle templates).
 *   - buildInputFiles: standalone files that shape what the live site runs
 *     even though they live outside the watched directories: the api-server
 *     dependency manifest (runtime deps like @huggingface/transformers and
 *     oxigraph are esbuild externals the bundle's package.json must mirror),
 *     the esbuild config with the externals list, the frontend dependency
 *     manifest, and its Vite build config.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export const DATA_FILES = [
  "laertius_sections.jsonl",
  "laertius_sections_en.jsonl",
  "laertius_verses.jsonl",
  "dl_sources.jsonl",
  "embedding-index.json",
];

/**
 * Evaluation-workbench SEED directories the bundle ships under data/eval/
 * (relative to artifacts/api-server/data/eval/). These are the immutable
 * inputs a clean install needs so /eval can serve the judging queue: the
 * pool, the issued batches, the frozen corpus snapshots, topic sets, runs,
 * and the gold reports. The LIVE state the server accumulates on the host —
 * eval/judgments/, eval/adjudications/ and eval/judge-tokens.json — is
 * deliberately NOT bundled: it must never be overwritten by a redeploy
 * (extracting the zip cannot touch paths it does not contain).
 */
export const EVAL_SEED_DIRS = [
  "pools",
  "batches",
  "snapshots",
  "topic-sets",
  "runs",
  "gold",
];

/**
 * Data files the Legomena companion app ships under legomena/data/
 * (relative to artifacts/legomena-api/data/). The cached embedding model is
 * deliberately not bundled (same policy as the main data/): both services
 * use the same Xenova/multilingual-e5-small cache, shared at runtime via
 * LEGOMENA_MODEL_CACHE.
 */
export const LEGOMENA_DATA_FILES = [
  "base.ttl",
  "tbox.ttl",
  "passages.ttl",
  "manifest.json",
  "embedding-index.json",
];

export function sourceDirs(repoRoot: string): string[] {
  return [
    path.join(repoRoot, "artifacts", "api-server", "src"),
    path.join(repoRoot, "artifacts", "laertius", "src"),
    // Static branding/assets Vite copies verbatim into the built frontend
    // (favicon.svg/png, apple-touch-icon.png, opengraph.jpg, wordmarks,
    // robots.txt, downloads/). A branding update here reshapes the shipped
    // bundle just like a src/ change, so it must count as a content source.
    path.join(repoRoot, "artifacts", "laertius", "public"),
    // The evaluation workbench SPA (public/eval/, BASE_PATH=/eval/): a src
    // change reshapes the shipped bundle just like a laertius src change.
    // Its static public/ (favicon.svg, robots.txt) is copied verbatim by
    // Vite, so a branding edit there counts as a content source too.
    path.join(repoRoot, "artifacts", "eval", "src"),
    path.join(repoRoot, "artifacts", "eval", "public"),
    path.join(repoRoot, "artifacts", "legomena-api", "src"),
    path.join(repoRoot, "exports", "ionos-bundle"),
  ];
}

export function buildInputFiles(repoRoot: string): string[] {
  return [
    // index.html is the Vite entry document (favicon/apple-touch links,
    // og:image tags) — it lives next to src/, not inside it, so it needs
    // an explicit watch or a branding edit passes freshness silently.
    path.join(repoRoot, "artifacts", "laertius", "index.html"),
    path.join(repoRoot, "artifacts", "api-server", "package.json"),
    path.join(repoRoot, "artifacts", "api-server", "build.mjs"),
    path.join(repoRoot, "artifacts", "laertius", "package.json"),
    path.join(repoRoot, "artifacts", "laertius", "vite.config.ts"),
    // The eval SPA's Vite entry document and build config (same rationale
    // as laertius above): a change here reshapes the /eval bundle.
    path.join(repoRoot, "artifacts", "eval", "index.html"),
    path.join(repoRoot, "artifacts", "eval", "package.json"),
    path.join(repoRoot, "artifacts", "eval", "vite.config.ts"),
    path.join(repoRoot, "artifacts", "legomena-api", "package.json"),
    path.join(repoRoot, "artifacts", "legomena-api", "build.mjs"),
  ];
}

/**
 * Content-hash manifest written next to the zip by build-ionos-bundle.ts.
 * The freshness check is mtime-based, but the platform's checkpoint commits
 * can rewrite unchanged files (touching their mtimes) after the zip is
 * built. The manifest lets the check distinguish a real content change from
 * an mtime-only touch: a source with a newer mtime whose sha256 still
 * matches the manifest entry recorded at build time is not stale.
 */
export function sourcesManifestPath(repoRoot: string): string {
  return path.join(repoRoot, "exports", "laertius-ionos.sources.json");
}

export function hashFile(p: string): string {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

/**
 * Every content source the freshness check watches, as absolute paths:
 * bundled data files, the watched source dirs (node_modules/dist skipped),
 * and the standalone build-input files.
 */
export function collectContentSources(repoRoot: string): string[] {
  const apiServerDir = path.join(repoRoot, "artifacts", "api-server");
  const legomenaApiDir = path.join(repoRoot, "artifacts", "legomena-api");
  const out: string[] = [];
  for (const f of DATA_FILES) out.push(path.join(apiServerDir, "data", f));
  const evalWalk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue; // local retrieval/fusion caches — not shipped
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) evalWalk(p);
      else if (entry.isFile()) out.push(p);
    }
  };
  for (const d of EVAL_SEED_DIRS) {
    const dir = path.join(apiServerDir, "data", "eval", d);
    if (existsSync(dir)) evalWalk(dir);
  }
  for (const f of LEGOMENA_DATA_FILES) {
    out.push(path.join(legomenaApiDir, "data", f));
  }
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walk(p);
      } else if (entry.isFile()) {
        out.push(p);
      }
    }
  };
  for (const dir of sourceDirs(repoRoot)) walk(dir);
  out.push(...buildInputFiles(repoRoot));
  return out;
}

/**
 * Reserved manifest key recording the sha256 of the zip the manifest was
 * written for. The manifest is git-tracked while the zip is not, so a
 * checkout can pair a NEWER committed manifest with an OLDER local zip —
 * the hash tie-break would then falsely certify a genuinely stale zip as
 * fresh. The freshness check only trusts a manifest whose recorded zip
 * hash matches the actual zip on disk.
 */
export const MANIFEST_ZIP_KEY = "__zip:exports/laertius-ionos.zip";

/**
 * Reserved manifest key recording whether the zip the manifest certifies
 * actually passed the smoke test ("passed") or was built with SKIP_SMOKE=1
 * ("skipped"). The hash binding alone only proves the zip came out of a
 * build — not that the smoke test ever saw it. Upload guards must require
 * "passed" here before shipping a zip without a rebuild.
 */
export const MANIFEST_SMOKE_KEY = "__smoke:status";
export type SmokeStatus = "passed" | "skipped";

/** Write the manifest: repo-relative path -> sha256 of every content source. */
export function writeSourcesManifest(
  repoRoot: string,
  smoke: SmokeStatus,
): void {
  const hashes: Record<string, string> = {};
  for (const p of collectContentSources(repoRoot)) {
    hashes[path.relative(repoRoot, p)] = hashFile(p);
  }
  const zipPath = path.join(repoRoot, "exports", "laertius-ionos.zip");
  if (existsSync(zipPath)) {
    hashes[MANIFEST_ZIP_KEY] = hashFile(zipPath);
  }
  hashes[MANIFEST_SMOKE_KEY] = smoke;
  writeFileSync(
    sourcesManifestPath(repoRoot),
    JSON.stringify(hashes, null, 2) + "\n",
  );
}

/**
 * Upgrade the manifest's smoke status to "passed" AFTER a standalone smoke
 * run succeeded against the zip the manifest is bound to. Refuses (returns
 * an error string) when the manifest is missing or bound to a different
 * zip — a passed smoke test on some other zip must never certify this one.
 */
export function markSourcesManifestSmokePassed(
  repoRoot: string,
  zipPath: string,
): string | null {
  const manifest = readSourcesManifest(repoRoot);
  if (!manifest) {
    return `no sources manifest at ${sourcesManifestPath(repoRoot)} to mark as smoke-passed`;
  }
  const recorded = manifest[MANIFEST_ZIP_KEY];
  if (!recorded || recorded !== hashFile(zipPath)) {
    return `the sources manifest is not bound to ${zipPath}; rebuild instead of certifying`;
  }
  manifest[MANIFEST_SMOKE_KEY] = "passed";
  writeFileSync(
    sourcesManifestPath(repoRoot),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return null;
}

export function readSourcesManifest(
  repoRoot: string,
): Record<string, string> | null {
  const p = sourcesManifestPath(repoRoot);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Record<string, string>;
}

/**
 * Verify the zip on disk is the exact zip the sources manifest was written
 * for (sha256 binding) AND that the smoke test actually passed against it:
 * the manifest records MANIFEST_SMOKE_KEY = "passed" only after
 * smokeIonosBundle succeeded (build-ionos-bundle writes "skipped" under
 * SKIP_SMOKE=1; a standalone smoke run upgrades it via
 * markSourcesManifestSmokePassed). Returns a ready-to-print error message,
 * or null when the zip is bound and smoke-certified.
 */
export function zipManifestBindingError(
  repoRoot: string,
  zipPath: string,
): string | null {
  const relZip = path.relative(repoRoot, zipPath);
  const relManifest = path.relative(repoRoot, sourcesManifestPath(repoRoot));
  const rebuild =
    `\n\nRebuild (build + smoke test) with:\n` +
    `  pnpm --filter @workspace/scripts run build-ionos-bundle`;
  const manifest = readSourcesManifest(repoRoot);
  if (!manifest) {
    return `UNVERIFIED ZIP: ${relManifest} does not exist, so nothing certifies that ${relZip} ever passed a build + smoke test.${rebuild}`;
  }
  const recorded = manifest[MANIFEST_ZIP_KEY];
  if (!recorded) {
    return `UNVERIFIED ZIP: ${relManifest} records no zip hash (predates zip-hash recording), so it cannot certify ${relZip}.${rebuild}`;
  }
  if (recorded !== hashFile(zipPath)) {
    return `UNVERIFIED ZIP: ${relZip} on disk does not match the hash recorded in ${relManifest} — the manifest was written for a DIFFERENT zip, so this one may never have passed the smoke test.${rebuild}`;
  }
  const smoke = manifest[MANIFEST_SMOKE_KEY];
  if (smoke !== "passed") {
    const detail =
      smoke === "skipped"
        ? `was built with SKIP_SMOKE=1 — the smoke test never saw it`
        : `predates smoke-status recording, so nothing proves the smoke test saw it`;
    return (
      `UNVERIFIED ZIP: ${relZip} is hash-bound to ${relManifest}, but the manifest ${detail}.` +
      `\n\nCertify it by running the smoke test standalone:\n` +
      `  pnpm --filter @workspace/scripts run smoke-ionos-bundle` +
      rebuild
    );
  }
  return null;
}

/**
 * Full pre-upload verification for a zip being shipped without a rebuild
 * (push-ionos-bundle SKIP_BUILD=1): the zip must exist, be hash-bound to the
 * sources manifest, and pass the same freshness check the check-bundle-
 * freshness validator runs. Returns { error, notes } like checkBundleFreshness.
 */
export function verifyZipForUpload(
  repoRoot: string,
  zipPath: string,
): { error: string | null; notes: string[] } {
  if (!existsSync(zipPath)) {
    return {
      error:
        `UNVERIFIED ZIP: ${path.relative(repoRoot, zipPath)} does not exist.\n` +
        `Build it with: pnpm --filter @workspace/scripts run build-ionos-bundle`,
      notes: [],
    };
  }
  const bindErr = zipManifestBindingError(repoRoot, zipPath);
  if (bindErr) return { error: bindErr, notes: [] };
  return checkBundleFreshness(repoRoot, zipPath);
}

/**
 * The full bundle-freshness check shared by check-bundle-freshness.ts and
 * e2e-ionos-legomena.ts: zip existence, template dependency-pin drift, and
 * the mtime-first / content-hash-confirmed staleness scan over every content
 * source. Returns `error` (the ready-to-print failure message, null when
 * fresh) plus `notes` (informational lines, e.g. mtime-only touches ignored
 * via the sources manifest).
 */
export function checkBundleFreshness(
  repoRoot: string,
  zipPath: string,
): { error: string | null; notes: string[] } {
  const notes: string[] = [];
  if (!existsSync(zipPath)) {
    return {
      error:
        `STALE BUNDLE: ${path.relative(repoRoot, zipPath)} does not exist.\n` +
        `Build it with: pnpm --filter @workspace/scripts run build-ionos-bundle`,
      notes,
    };
  }
  const zipMtime = statSync(zipPath).mtimeMs;

  const depDrift = bundleDependencyDrift(repoRoot);
  if (depDrift.length > 0) {
    return {
      error:
        `STALE BUNDLE: the bundle template's dependency pins drifted from the workspace-resolved versions:\n` +
        depDrift.map((m) => `  - ${m}`).join("\n") +
        `\n\nFix the pin(s) in exports/ionos-bundle/package.json, then rebuild:\n` +
        `  pnpm --filter @workspace/scripts run build-ionos-bundle`,
      notes,
    };
  }

  let sources: string[];
  try {
    sources = collectContentSources(repoRoot);
  } catch (err) {
    return {
      error: `STALE BUNDLE CHECK FAILED: ${String(err)}`,
      notes,
    };
  }
  for (const p of sources) {
    if (!existsSync(p)) {
      return {
        error: `STALE BUNDLE CHECK FAILED: missing content source ${p}`,
        notes,
      };
    }
  }

  let newer = sources
    .map((file) => ({ file, mtimeMs: statSync(file).mtimeMs }))
    .filter((s) => s.mtimeMs > zipMtime)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  // mtime is only a first pass: platform checkpoint commits can rewrite
  // unchanged files after the zip is built, touching their mtimes without
  // changing content. If the build wrote a sources manifest, a newer-mtime
  // file whose sha256 still matches the hash recorded at build time is not
  // actually stale. Files missing from the manifest (added after the build)
  // stay stale.
  if (newer.length > 0) {
    let manifest = readSourcesManifest(repoRoot);
    if (manifest) {
      // Only trust a manifest written for THIS zip. The manifest is
      // git-tracked but the zip is not, so a newer committed manifest can
      // sit next to an older local zip; trusting it would certify a stale
      // zip as fresh (the exact waste this check exists to prevent).
      const recordedZip = manifest[MANIFEST_ZIP_KEY];
      if (!recordedZip || recordedZip !== hashFile(zipPath)) {
        notes.push(
          recordedZip
            ? "Sources manifest was written for a different zip; ignoring it and comparing mtimes only."
            : "Sources manifest predates zip-hash recording; ignoring it and comparing mtimes only.",
        );
        manifest = null;
      }
    }
    if (manifest) {
      const trulyChanged = newer.filter((s) => {
        const rel = path.relative(repoRoot, s.file);
        const recorded = manifest[rel];
        return !recorded || hashFile(s.file) !== recorded;
      });
      if (trulyChanged.length < newer.length) {
        notes.push(
          `${newer.length - trulyChanged.length} file(s) had newer mtimes but unchanged content (per the sources manifest); ignoring.`,
        );
      }
      newer = trulyChanged;
    }
  }

  if (newer.length === 0) {
    notes.push(
      `Bundle is fresh: ${path.relative(repoRoot, zipPath)} (${new Date(zipMtime).toISOString()}) ` +
        `is newer than all ${sources.length} content sources.`,
    );
    return { error: null, notes };
  }

  const shown = newer.slice(0, 15);
  return {
    error:
      `STALE BUNDLE: ${path.relative(repoRoot, zipPath)} was built ${new Date(zipMtime).toISOString()}, ` +
      `but ${newer.length} content file(s) changed since then:\n` +
      shown
        .map(
          (s) =>
            `  - ${path.relative(repoRoot, s.file)} (${new Date(s.mtimeMs).toISOString()})`,
        )
        .join("\n") +
      (newer.length > shown.length
        ? `\n  ... and ${newer.length - shown.length} more`
        : "") +
      `\n\nRebuild and re-upload the bundle:\n` +
      `  pnpm --filter @workspace/scripts run build-ionos-bundle`,
    notes,
  };
}

/**
 * Compare the package.json actually shipped inside an extracted bundle
 * against the template at exports/ionos-bundle/package.json. Catches a zip
 * built before a pin change: the mtime freshness check usually flags this,
 * but this is a direct content-level pin. Compares the dependencies map
 * exactly (missing, extra, and version-mismatched entries all fail).
 * Returns human-readable drift messages (empty = in sync).
 */
export function zipPackageJsonDrift(
  repoRoot: string,
  extractedBundleDir: string,
): string[] {
  const templatePath = path.join(repoRoot, "exports", "ionos-bundle", "package.json");
  const zipManifestPath = path.join(extractedBundleDir, "package.json");
  const problems: string[] = [];
  if (!existsSync(zipManifestPath)) {
    problems.push(
      "the bundle zip ships no package.json (expected a copy of exports/ionos-bundle/package.json)",
    );
    return problems;
  }
  const readDeps = (p: string): Record<string, string> =>
    (JSON.parse(readFileSync(p, "utf8")) as { dependencies?: Record<string, string> })
      .dependencies ?? {};
  const templateDeps = readDeps(templatePath);
  const zipDeps = readDeps(zipManifestPath);
  for (const [name, range] of Object.entries(templateDeps)) {
    if (!(name in zipDeps)) {
      problems.push(
        `the zip's package.json is missing ${name} (template pins ${range}); rebuild the bundle`,
      );
    } else if (zipDeps[name] !== range) {
      problems.push(
        `${name}: the zip's package.json pins ${zipDeps[name]} but the template pins ${range}; the zip predates a pin change, rebuild the bundle`,
      );
    }
  }
  for (const [name, range] of Object.entries(zipDeps)) {
    if (!(name in templateDeps)) {
      problems.push(
        `the zip's package.json pins ${name}@${range}, which the template no longer declares; rebuild the bundle`,
      );
    }
  }
  return problems;
}

/**
 * The shipped package-lock.json must exist next to the template package.json
 * and resolve exactly the versions package.json pins, or the README's
 * documented `npm ci` fails (or installs a different tree) on the server.
 * build-ionos-bundle calls this in its preflight so a missing/stale lockfile
 * fails the build. Returns human-readable problems (empty = in sync).
 */
export function bundleLockfileDrift(repoRoot: string): string[] {
  const templateDir = path.join(repoRoot, "exports", "ionos-bundle");
  const lockPath = path.join(templateDir, "package-lock.json");
  const problems: string[] = [];
  if (!existsSync(lockPath)) {
    problems.push(
      "exports/ionos-bundle/package-lock.json is missing — `npm ci` on the server would fail",
    );
    return problems;
  }
  const manifest = JSON.parse(
    readFileSync(path.join(templateDir, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string>; overrides?: Record<string, string> };
  const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
    lockfileVersion?: number;
    packages?: Record<string, { version?: string }>;
  };
  const pkgs = lock.packages ?? {};
  if (!lock.lockfileVersion || Object.keys(pkgs).length === 0) {
    problems.push(
      "exports/ionos-bundle/package-lock.json has no packages map — regenerate it",
    );
    return problems;
  }
  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    const locked = pkgs[`node_modules/${name}`]?.version;
    if (!locked) {
      problems.push(
        `package-lock.json does not lock ${name} (package.json pins ${range}) — regenerate it`,
      );
    } else if (locked !== range.replace(/^[\^~]/, "")) {
      problems.push(
        `${name}: package-lock.json locks ${locked} but package.json pins ${range} — regenerate it`,
      );
    }
  }
  for (const [name, version] of Object.entries(manifest.overrides ?? {})) {
    // Overrides are mandatory in the lock: an absent entry means the
    // override target dropped out of the locked tree (or the lockfile was
    // hand-edited) and `npm ci` would install an unpinned version later.
    const locked = pkgs[`node_modules/${name}`]?.version;
    if (!locked) {
      problems.push(
        `package-lock.json has no node_modules/${name} entry, but package.json declares an override pinning ${version} — regenerate it`,
      );
    } else if (locked !== version) {
      problems.push(
        `${name}: package-lock.json locks ${locked} but the package.json override pins ${version} — regenerate it`,
      );
    }
  }
  return problems;
}

/**
 * Compare the bundle template's pinned dependency versions against the
 * versions actually resolved in artifacts/api-server/node_modules. The
 * template package.json is copied verbatim into the zip, so if the workspace
 * lockfile resolves a different version than the template pins, the live
 * site would install a dependency the server bundle was never built or
 * smoke-tested against. Returns a list of human-readable drift messages
 * (empty = in sync).
 */
export function bundleDependencyDrift(repoRoot: string): string[] {
  const templatePath = path.join(repoRoot, "exports", "ionos-bundle", "package.json");
  const template = JSON.parse(readFileSync(templatePath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const deps = template.dependencies ?? {};
  const problems: string[] = [];
  if (Object.keys(deps).length === 0) {
    problems.push(
      "exports/ionos-bundle/package.json declares no dependencies; expected the native runtime deps (@huggingface/transformers, oxigraph)",
    );
    return problems;
  }
  for (const [name, range] of Object.entries(deps)) {
    const pinned = range.replace(/^[\^~]/, "");
    if (!/^\d+\.\d+\.\d+/.test(pinned)) {
      problems.push(
        `exports/ionos-bundle/package.json pins ${name}@${range}, which is not a plain semver pin the drift check can compare`,
      );
      continue;
    }
    const resolvedManifest = path.join(
      repoRoot,
      "artifacts",
      "api-server",
      "node_modules",
      ...name.split("/"),
      "package.json",
    );
    if (!existsSync(resolvedManifest)) {
      problems.push(
        `${name} is pinned in exports/ionos-bundle/package.json but is not installed under artifacts/api-server/node_modules (run pnpm install)`,
      );
      continue;
    }
    const resolved = (
      JSON.parse(readFileSync(resolvedManifest, "utf8")) as { version: string }
    ).version;
    if (resolved !== pinned) {
      problems.push(
        `${name}: exports/ionos-bundle/package.json pins ${range} but the workspace resolves ${resolved} (update the template pin and rebuild the bundle)`,
      );
    }
  }
  return problems;
}
