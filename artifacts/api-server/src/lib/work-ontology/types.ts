/** Shared types for the work-ontology chunk files (see ../work-ontology.ts). */

export type WorkForm = "prose" | "verse" | "mixed";

export type WorkSurvival = "lost" | "excerpts" | "extant";

export type WorkTopic =
  | "physics"
  | "ethics"
  | "dialectic"
  | "politics"
  | "rhetoric"
  | "grammar"
  | "poetics"
  | "mathematics"
  | "astronomy"
  | "geography"
  | "medicine"
  | "music"
  | "technical"
  | "history"
  | "biography"
  | "chronology"
  | "doxography"
  | "epic"
  | "lyric"
  | "tragedy"
  | "comedy"
  | "satire"
  | "letters"
  | "miscellany";

export interface WorkFacet {
  /** null = the form is genuinely unknown (curated ignorance, not a default). */
  form: WorkForm | null;
  /** null = the topic cannot be responsibly assigned from the title alone. */
  topic: WorkTopic | null;
  /**
   * Rare override of the topic-derived philosophical flag (e.g. actual
   * legislation and policy pamphlets under politics are NOT philosophy).
   */
  philosophical?: boolean;
  /**
   * Transmission status. Absent = "lost" (only the title survives) - the
   * overwhelming condition of D.L.'s catalogues, so it is the default.
   * "excerpts" = the work survives only in quoted fragments and excerpts
   * (including verse quoted by D.L. himself); "extant" = the work survives
   * entire or substantially so through the manuscript tradition - including
   * texts preserved verbatim inside D.L. (Epicurus' three letters and
   * Principal Doctrines). Explicit null = deliberately unasserted: the label
   * is a conflated homonym node whose constituent works have DIVERGENT
   * transmission (e.g. "Symposium" = Xenophon's extant dialogue + Epicurus'
   * lost one), so no single status would be true of the node.
   */
  survival?: WorkSurvival | null;
}
