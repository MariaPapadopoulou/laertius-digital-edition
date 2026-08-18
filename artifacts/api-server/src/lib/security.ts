import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Request, RequestHandler } from "express";

/**
 * Security hardening for the self-hosted (IONOS) deployment: response
 * headers (CSP, HSTS, nosniff, referrer policy) and a dependency-free
 * per-IP fixed-window rate limiter for the API and the expensive RAG
 * endpoints (/api/ask, /api/search).
 */

/**
 * CSP script-src hashes for the inline scripts in the built index.html
 * (the theme-bootstrap snippet). Computed from the actually served file so
 * the policy can never drift from the markup.
 */
export function inlineScriptHashes(indexHtmlPath: string): string[] {
  const html = readFileSync(indexHtmlPath, "utf8");
  const hashes: string[] = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const body = m[1] ?? "";
    if (body.trim().length === 0) continue;
    const digest = createHash("sha256").update(body, "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
  }
  return hashes;
}

export interface SecurityHeaderOptions {
  /** Extra script-src sources (e.g. inline-script hashes). */
  scriptSrcExtra?: string[];
  /** Extra img-src origins (e.g. the OSM tile server for the Map page). */
  imgSrcExtra?: string[];
}

/**
 * Sets CSP, HSTS, X-Content-Type-Options and Referrer-Policy on every
 * response. The CSP fits a fully self-hosted app: fonts are local
 * (@fontsource), all data comes from the same origin; the only external
 * origin is the OpenStreetMap tile server used by the Map page (passed in
 * via imgSrcExtra). frame-ancestors 'none' (clickjacking protection) is
 * emitted only in production: the development preview renders the app
 * inside an iframe, which frame-ancestors would block.
 */
export function securityHeaders(
  options: SecurityHeaderOptions = {},
): RequestHandler {
  const scriptSrc = ["'self'", ...(options.scriptSrcExtra ?? [])].join(" ");
  const imgSrc = ["'self'", "data:", "blob:", ...(options.imgSrcExtra ?? [])]
    .join(" ");
  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSrc}`,
    // data: is required: Vite inlines small font files (< assetsInlineLimit)
    // into the built CSS as data: URIs, which font-src 'self' alone blocks.
    // The CSP e2e sweep (e2e-csp-violations) caught exactly this in the
    // built bundle: twelve font-src violations on every page.
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    ...(process.env["NODE_ENV"] === "production"
      ? [`frame-ancestors 'none'`]
      : []),
  ].join("; ");
  return (_req, res, next) => {
    res.setHeader("Content-Security-Policy", csp);
    // One year; the live site is HTTPS-only behind the IONOS proxy.
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  };
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests per client per window. 0 disables the limiter. */
  max: number;
  /** Bucket name, so different limiters never share counters. */
  name: string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

function clientKey(req: Request): string {
  // req.ip honors Express "trust proxy"; fall back for direct sockets.
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/**
 * Per-IP fixed-window rate limiter (no external dependency). Emits
 * X-RateLimit-Limit/-Remaining on every response and answers 429 with a
 * Retry-After header and a JSON error once the window is exhausted.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  const { windowMs, max } = options;
  if (max <= 0) {
    return (_req, _res, next) => next();
  }
  const windows = new Map<string, WindowEntry>();
  let lastSweep = 0;
  return (req, res, next) => {
    const now = Date.now();
    // Occasionally drop expired windows so the map cannot grow unbounded.
    if (now - lastSweep > windowMs) {
      lastSweep = now;
      for (const [key, entry] of windows) {
        if (entry.resetAt <= now) windows.delete(key);
      }
    }
    const key = clientKey(req);
    let entry = windows.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(key, entry);
    }
    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    if (entry.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "Too many requests, please slow down.",
      });
      return;
    }
    next();
  };
}

/** Parse a rate-limit max from the environment; 0 disables the limiter. */
export function rateLimitMaxFromEnv(
  envVar: string,
  defaultMax: number,
): number {
  const raw = process.env[envVar];
  if (raw === undefined || raw.trim() === "") return defaultMax;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${envVar} value: "${raw}"`);
  }
  return Math.floor(n);
}
