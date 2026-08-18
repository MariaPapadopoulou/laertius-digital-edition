/**
 * Deterministic check for parallel-edge geometry in the Legomena graph view.
 * Run: npx tsx artifacts/laertius/scripts/check-edge-paths.mts
 *
 * Asserts that:
 * - a single edge stays a straight line
 * - same-direction parallels (A→B, A→B) get distinct arcs
 * - opposite-direction parallels (A→B, B→A) get distinct arcs (canonical
 *   orientation, not per-edge direction, decides the arc side)
 * - three parallels are pairwise distinct
 */
import assert from "node:assert/strict";
import { assignEdgePaths, edgePath } from "../src/components/legomena/graph-view";

const A = { x: 100, y: 100 };
const B = { x: 300, y: 200 };

// Straight line when unique.
assert.equal(edgePath(A, B, 0, 1), "M 100 100 L 300 200");

// Two and three parallels are pairwise distinct.
assert.notEqual(edgePath(A, B, 0, 2), edgePath(A, B, 1, 2));
const trio = [0, 1, 2].map((k) => edgePath(A, B, k, 3));
assert.equal(new Set(trio).size, 3);

// Layout-level: opposite-direction parallels must not collapse.
const nodeA = { node: { uri: "urn:a" } as any, ...A, r: 5, color: "#000" };
const nodeB = { node: { uri: "urn:b" } as any, ...B, r: 5, color: "#000" };
const byUri = new Map([["urn:a", nodeA], ["urn:b", nodeB]]);

const mk = (fromUri: string, toUri: string, type: string) =>
  ({ fromUri, toUri, type } as any);

const opposite = assignEdgePaths([mk("urn:a", "urn:b", "teacherOf"), mk("urn:b", "urn:a", "influenced")], byUri as any);
assert.equal(opposite.length, 2);
assert.notEqual(opposite[0].d, opposite[1].d, "A→B and B→A parallels must render distinct arcs");
// Also not merely the same curve traversed in reverse: control points differ.
const ctrl = (d: string) => d.match(/Q ([-\d.]+) ([-\d.]+)/)?.slice(1).join(",");
assert.notEqual(ctrl(opposite[0].d), ctrl(opposite[1].d), "control points must differ");

const same = assignEdgePaths([mk("urn:a", "urn:b", "teacherOf"), mk("urn:a", "urn:b", "influenced")], byUri as any);
assert.notEqual(same[0].d, same[1].d, "same-direction parallels must render distinct arcs");

// Each arc keeps its own edge payload (detail card shows the right citation).
assert.equal(opposite[0].edge.type, "teacherOf");
assert.equal(opposite[1].edge.type, "influenced");

console.log("edge-path checks passed");
