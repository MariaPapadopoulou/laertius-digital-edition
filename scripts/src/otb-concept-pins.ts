/**
 * Derived OTB TBox pins for the IONOS bundle smoke test.
 *
 * The smoke test used to hard-code the concept count in two places (the
 * /api/otb/overview counts check and the ontology-viewer "N concepts, "
 * content control). Every concept-inventory edit then required a manual
 * pin bump, and a missed bump only surfaced at the END of the expensive
 * bundle build. Deriving the pins from the SAME inventory module the
 * server bundle is compiled from makes drift impossible: the smoke test
 * always expects exactly what the current source declares, and a stale
 * BUNDLE (built before an inventory edit) still fails with an exact
 * count mismatch, which is the check's real job.
 *
 * validate-otb-concept-pins guards this contract: it proves the derived
 * pins track the live inventory and that the smoke test consumes these
 * constants instead of re-introducing hard-coded literals.
 */
import {
  CATEGORIES,
  CONCEPTS,
} from "../../artifacts/api-server/src/lib/otb/inventory";

/** Expected otb.counts.concepts from /api/otb/overview. */
export const OTB_CONCEPT_PIN_COUNT = CONCEPTS.length;

/** Expected otb.counts.categories from /api/otb/overview. */
export const OTB_CATEGORY_PIN_COUNT = CATEGORIES.length;

/**
 * The stats-line fragment the ontology viewer HTML must contain
 * ("N concepts, " — the object count that follows is left free).
 */
export const OTB_VIEWER_CONCEPT_STATS_FRAGMENT = `${OTB_CONCEPT_PIN_COUNT} concepts, `;
