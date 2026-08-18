// Pure predicates behind the provenance lines in the claims panel:
// the "according to ..." attribution line renders exactly when a claim
// carries a non-empty accordingTo, and the "via ..." transmission chain
// line renders exactly when the chain has at least one entry. Kept as a
// standalone module so the validate-claims-grc script can unit-test them
// and pin the claims-panel wiring.
export function hasAttribution(claim: { accordingTo?: string }): boolean {
  return (
    typeof claim.accordingTo === "string" && claim.accordingTo.trim().length > 0
  );
}

export function hasChain(claim: { chain?: unknown[] }): boolean {
  return Array.isArray(claim.chain) && claim.chain.length > 0;
}
