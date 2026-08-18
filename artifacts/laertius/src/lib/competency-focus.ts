// Pure predicate behind the /competency ?focus= URL validation.
//
// A shared link can carry any focus value; the drill-down panel must only
// open when the name is actually a node of the loaded subgraph. Otherwise
// the page shows a small dismissible notice instead of a "Passages naming X"
// panel for a name the question never surfaced.
//
// Kept as a standalone module (no React imports) so validate-competency-focus
// can unit-test it directly; the page must route its decision through
// resolveCompetencyFocus, which the validator pins.

export interface CompetencyFocusState {
  // The validated focus name, or null when the focus is absent or unknown.
  validFocusedEntity: string | null;
  // True when a focus was requested but is not in the subgraph and the
  // result has finished loading: the page shows the notice, not the panel.
  staleFocus: boolean;
}

export function resolveCompetencyFocus(args: {
  focusedEntity: string | null;
  nodeNames: readonly string[];
  resultLoading: boolean;
  hasResult: boolean;
}): CompetencyFocusState {
  const { focusedEntity, nodeNames, resultLoading, hasResult } = args;
  const focusInSubgraph =
    focusedEntity !== null && nodeNames.includes(focusedEntity);
  return {
    validFocusedEntity: focusInSubgraph ? focusedEntity : null,
    staleFocus:
      focusedEntity !== null && !resultLoading && hasResult && !focusInSubgraph,
  };
}
