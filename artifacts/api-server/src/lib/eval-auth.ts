import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";
import type { Request, RequestHandler, Response } from "express";

/**
 * HTTP Basic auth gate for the evaluation workbench (the /eval frontend and
 * its /api/eval API), controlled by the EVAL_ACCESS_PASSWORD environment
 * variable.
 *
 *   - UNSET or empty: the middleware is a no-op, so the development
 *     workspace stays fully open (the eval app is a normal internal tool
 *     there).
 *   - set: HTTP Basic auth is required on every request whose CANONICAL
 *     path targets the eval workbench. Any username is accepted; the
 *     password must match EVAL_ACCESS_PASSWORD. On failure the response is
 *     401 with a WWW-Authenticate challenge so a browser prompts for
 *     credentials.
 *
 * WHY THIS IS A GLOBAL, CANONICALIZING MIDDLEWARE (not app.use("/eval", …)):
 * a path-mounted gate only matches Express's OWN normalized mount path, but
 * express.static resolves the file from the raw URL with different rules.
 * That mismatch let requests like //eval/assets/x, /eval%2Fassets%2Fx and
 * /eval/../eval/ reach the static file WITHOUT ever matching the "/eval"
 * mount — a real auth bypass. So this middleware runs globally, decodes and
 * canonicalizes the raw request target ITSELF (the same way a static file
 * server ultimately would), and gates on the canonical path. Anything that
 * canonicalizes to /eval, /eval/*, /api/eval or /api/eval/* is gated; the
 * decode + normalize happens BEFORE the check, so encoded-slash / traversal
 * trickery cannot slip past.
 *
 * The password comparison is constant-time: both sides are SHA-256 hashed
 * first so the two buffers are always equal-length (timingSafeEqual throws
 * on differing lengths, and a length check would itself leak the secret's
 * length), then compared with crypto.timingSafeEqual.
 */

/**
 * Canonicalize a raw request target (req.url / req.originalUrl, which may
 * contain a query string) down to the path a file server would ultimately
 * resolve:
 *   1. strip the query/fragment,
 *   2. percent-decode (so %2F becomes a real slash — the encoded-slash
 *      bypass),
 *   3. convert backslashes to forward slashes (Windows-style separators),
 *   4. collapse runs of slashes to one (so //eval and ///eval normalize),
 *   5. resolve . and .. dot-segments with POSIX path.normalize,
 *   6. drop a trailing slash except for the root.
 * Returns null when the target is malformed (a bad percent-encoding), so the
 * caller can answer 400 rather than guess.
 */
export function canonicalizeRequestPath(rawTarget: string): string | null {
  // Drop query string and fragment.
  let target = rawTarget.split("#")[0]!.split("?")[0]!;
  // Percent-decode. Malformed encodings (e.g. a stray %) throw.
  try {
    target = decodeURIComponent(target);
  } catch {
    return null;
  }
  // Windows-style separators → forward slashes.
  target = target.replace(/\\/g, "/");
  // A canonical absolute path always starts with a slash.
  if (!target.startsWith("/")) target = `/${target}`;
  // Collapse duplicate slashes so //eval, ///eval, etc. normalize. Do this
  // before path.normalize (which does NOT collapse a leading //).
  target = target.replace(/\/{2,}/g, "/");
  // Resolve dot-segments (., ..) the POSIX way. path.posix.normalize keeps a
  // leading slash and cannot escape above root.
  target = path.posix.normalize(target);
  // Re-collapse (normalize can reintroduce nothing here, but be defensive)
  // and strip a trailing slash except for the root.
  if (target.length > 1 && target.endsWith("/")) {
    target = target.replace(/\/+$/, "");
  }
  return target;
}

/** True when the canonical path targets the eval workbench (frontend or API). */
export function isEvalPath(canonicalPath: string): boolean {
  return (
    canonicalPath === "/eval" ||
    canonicalPath.startsWith("/eval/") ||
    canonicalPath === "/api/eval" ||
    canonicalPath.startsWith("/api/eval/")
  );
}

/**
 * HTTP Basic auth gate for the eval COORDINATOR surface (pool/run/snapshot
 * management, batch issuing, judgment listing, adjudication — everything
 * that can disclose or mint per-judge access tokens), controlled by
 * EVAL_COORDINATOR_PASSWORD.
 *
 * This is a second, stricter layer inside the shared EVAL_ACCESS_PASSWORD
 * gate: judges only ever need their personal access key (the three
 * judge-facing endpoints are mounted BEFORE this middleware), while every
 * management endpoint requires the coordinator's own password. A judge who
 * can load their personal link therefore cannot enumerate pools, read other
 * judges' batches, or harvest anyone's bearer token.
 *
 * FAIL CLOSED: unlike the outer shared gate, an UNSET password does not
 * open the coordinator surface — it answers 403 with a configuration hint.
 * Bearer-token-disclosing endpoints must never be public by default.
 */
export function evalCoordinatorAuth(): RequestHandler {
  const expected = process.env["EVAL_COORDINATOR_PASSWORD"];
  if (expected === undefined || expected === "") {
    return (_req, res) => {
      res.status(403).json({
        error:
          "Coordinator access is not configured. Set EVAL_COORDINATOR_PASSWORD to enable the eval management endpoints.",
      });
    };
  }
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return (req, res, next) => {
    const header = req.headers["authorization"];
    if (header && header.startsWith("Basic ")) {
      let decoded = "";
      try {
        decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
      } catch {
        decoded = "";
      }
      const sep = decoded.indexOf(":");
      if (sep !== -1) {
        const givenHash = createHash("sha256")
          .update(decoded.slice(sep + 1), "utf8")
          .digest();
        if (
          givenHash.length === expectedHash.length &&
          timingSafeEqual(givenHash, expectedHash)
        ) {
          next();
          return;
        }
      }
    }
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Laertius Evaluation Coordinator", charset="UTF-8"',
    );
    res.status(401).type("text/plain").send("Coordinator authentication required.");
  };
}

export function evalAuth(): RequestHandler {
  const expected = process.env["EVAL_ACCESS_PASSWORD"];
  if (expected === undefined || expected === "") {
    // No-op: dev workspace (and any deployment that leaves the var unset)
    // keeps the eval workbench open.
    return (_req, _res, next) => next();
  }

  // The coordinator's own password (see evalCoordinatorAuth) also satisfies
  // the outer shared gate: both gates read the same HTTP Basic Authorization
  // header, so the coordinator logs in ONCE with their password and passes
  // both layers, while judges keep using the shared password plus their
  // personal access key.
  const acceptedHashes = [createHash("sha256").update(expected, "utf8").digest()];
  const coordinator = process.env["EVAL_COORDINATOR_PASSWORD"];
  if (coordinator !== undefined && coordinator !== "") {
    acceptedHashes.push(createHash("sha256").update(coordinator, "utf8").digest());
  }

  const challenge = (res: Response) => {
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Laertius Evaluation", charset="UTF-8"',
    );
    res.status(401).type("text/plain").send("Authentication required.");
  };

  const credentialsValid = (req: Request): boolean => {
    const header = req.headers["authorization"];
    if (!header || !header.startsWith("Basic ")) return false;
    let decoded: string;
    try {
      decoded = Buffer.from(header.slice("Basic ".length), "base64").toString(
        "utf8",
      );
    } catch {
      return false;
    }
    // "username:password" — the password may itself contain colons.
    const sep = decoded.indexOf(":");
    if (sep === -1) return false;
    const password = decoded.slice(sep + 1);
    const givenHash = createHash("sha256").update(password, "utf8").digest();
    // Scan every accepted hash without early exit so timing does not reveal
    // WHICH credential matched.
    let matched = false;
    for (const accepted of acceptedHashes) {
      if (
        givenHash.length === accepted.length &&
        timingSafeEqual(givenHash, accepted)
      ) {
        matched = true;
      }
    }
    return matched;
  };

  return (req, res, next) => {
    // Canonicalize the RAW target (originalUrl preserves encoded slashes and
    // the full path Express saw) before deciding whether the eval gate
    // applies. Anything malformed is rejected outright rather than allowed
    // through by a decode failure.
    const canonical = canonicalizeRequestPath(req.originalUrl);
    if (canonical === null) {
      res.status(400).type("text/plain").send("Bad request.");
      return;
    }
    if (!isEvalPath(canonical)) {
      next();
      return;
    }
    if (credentialsValid(req)) {
      next();
      return;
    }
    challenge(res);
  };
}
