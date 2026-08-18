/**
 * card-headings — single point of change for the heading levels used by
 * list/card headings across the Laertius site.
 *
 * History: card headings moved from <h3> to <h2> once and eight e2e scripts
 * had to be patched by hand from querySelectorAll("h3") to ("h2, h3"). Any
 * future heading-level change (h4, per-page differences, …) would repeat that
 * silent breakage. E2E scripts must therefore never hardcode heading-tag
 * selectors; they import CARD_HEADING_SELECTOR and pass it into
 * page.evaluate / page.waitForFunction as an argument (browser-context
 * callbacks cannot close over Node-side imports).
 *
 * validate-card-heading-selector enforces this: it fails if any e2e script
 * hardcodes a "h3" / "h2, h3" querySelector instead of using this module.
 */

/**
 * CSS selector matching every heading level a card heading may use.
 * If the app's card heading level changes again, update ONLY this constant
 * (and the mirrored literal inside browser-evaluated code is forbidden, so
 * there is nothing else to chase).
 */
export const CARD_HEADING_SELECTOR = "h2, h3";

/**
 * CSS selector matching PAGE-LEVEL title headings (page titles, detail-panel
 * titles). Today the app renders these as <h2>; if that ever changes
 * (h2 → h1, per-page differences), update ONLY this constant. E2E scripts
 * must pass this into page.evaluate / waitForFunction as an argument, never
 * hardcode a bare "h2" query — validate-card-heading-selector enforces this.
 */
export const PAGE_HEADING_SELECTOR = "h2";

/** Minimal structural type so the helper works on Document or Element roots. */
type QueryRoot = { querySelectorAll(selectors: string): ArrayLike<Element> };

/** All card headings under `root`, in document order. */
export function cardHeadings(root: QueryRoot): Element[] {
  return Array.from(root.querySelectorAll(CARD_HEADING_SELECTOR));
}

/**
 * Find the card heading whose whitespace-normalized text exactly equals
 * `text` (Node-side DOM contexts only — inside page.evaluate, pass
 * CARD_HEADING_SELECTOR as an argument instead).
 */
export function findCardHeading(
  root: QueryRoot,
  text: string,
): Element | undefined {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const wanted = norm(text);
  return cardHeadings(root).find((h) => norm(h.textContent ?? "") === wanted);
}
