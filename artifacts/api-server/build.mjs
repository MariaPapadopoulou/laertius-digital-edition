import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, readFile, writeFile } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@huggingface/transformers",
      "oxigraph",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });

  // esbuild-plugin-pino bakes the absolute build-time output dir into
  // pinoBundlerAbsolutePath in EVERY emitted file (index.mjs plus the
  // pino-file/pino-worker/pino-pretty worker bundles), which breaks when
  // the bundle is deployed to a different machine/path and leaks the
  // build-time directory. Rewrite all of them to resolve relative to the
  // bundle's own directory at runtime. index.mjs gets __dirname from the
  // banner; worker files are plain scripts where CJS __dirname exists.
  const { readdir } = await import("node:fs/promises");
  let patchedCount = 0;
  for (const entry of await readdir(distDir)) {
    if (!entry.endsWith(".mjs")) continue;
    const filePath = path.join(distDir, entry);
    const code = await readFile(filePath, "utf8");
    const replacement =
      entry === "index.mjs"
        ? "const outputDir = globalThis.__dirname;"
        : 'const outputDir = __bpp_path.dirname(__bpp_url.fileURLToPath(import.meta.url));';
    let patched = code.replace(/const outputDir = ".*?";/, replacement);
    if (patched === code) continue;
    if (entry !== "index.mjs") {
      patched =
        'import __bpp_path from "node:path";\nimport __bpp_url from "node:url";\n' +
        patched;
    }
    await writeFile(filePath, patched);
    patchedCount += 1;
  }
  if (patchedCount === 0) {
    throw new Error("pino outputDir pattern not found; check esbuild-plugin-pino output");
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
