// Pure badge selection behind the certainty and transmission badges in
// the claims panel: reported ("some say"), disputed, and conjectured
// claims get a certainty badge (asserted claims get none), and claims
// with a transmission status (spurious, disputed-authorship, extant,
// lost - the last backed by D.L.'s burnt-works reports, e.g. Empedocles
// 8.57) get a transmission badge, suppressed when its label would
// duplicate the certainty badge's label. Today no certainty label equals
// a transmission label, so the suppression cannot fire on real data; it
// is kept deliberately (and unit-tested in validate-claims-grc) as a
// contract guard should either vocabulary's labels ever converge.
// Kept as a standalone module so
// the validate-claims-grc script can unit-test it and pin the
// claims-panel wiring.

export type Badge = { label: string; className: string };

const CERTAINTY_BADGE: Record<string, Badge | undefined> = {
  reported: {
    label: "some say",
    className: "text-foreground border-border",
  },
  disputed: {
    label: "disputed",
    className: "text-destructive border-border",
  },
  conjectured: {
    label: "conjectured",
    className: "text-muted-foreground border-border",
  },
};

const TRANSMISSION_BADGE: Record<string, Badge | undefined> = {
  spurious: {
    label: "spurious",
    className: "text-destructive border-border",
  },
  "disputed-authorship": {
    label: "disputed authorship",
    className: "text-foreground border-border",
  },
  extant: {
    label: "extant",
    className: "text-foreground border-border",
  },
  lost: {
    label: "lost",
    className: "text-muted-foreground border-border",
  },
};

export function certaintyBadge(claim: { certainty: string }): Badge | undefined {
  return CERTAINTY_BADGE[claim.certainty];
}

export function transmissionBadge(claim: {
  certainty: string;
  transmission?: string;
}): Badge | undefined {
  if (!claim.transmission) return undefined;
  const badge = TRANSMISSION_BADGE[claim.transmission];
  if (!badge) return undefined;
  const certainty = certaintyBadge(claim);
  if (certainty && certainty.label === badge.label) return undefined;
  return badge;
}
