// Pure predicate behind the "Source text" quotation block in the claims
// panel: the block renders exactly when a claim carries a non-empty grc
// excerpt. Kept as a standalone module so the validate-claims-grc script
// can unit-test it and pin the claims-panel wiring.
export function hasSourceText(claim: { grc?: string }): boolean {
  return typeof claim.grc === "string" && claim.grc.trim().length > 0;
}
