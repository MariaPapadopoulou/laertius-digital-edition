import { useMemo, useState } from "react";
import { grcSpans } from "@/lib/grc";
import { Link } from "wouter";
import { useGetPhilosopherClaims, Claim } from "@workspace/api-client-react";
import { hasSourceText } from "./claims-source-text";
import { hasAttribution, hasChain } from "./claims-provenance";
import { certaintyBadge, transmissionBadge } from "./claims-badges";
import { useGreekSourcePref } from "../hooks/use-greek-source-pref";

const GROUPS: { title: string; properties: string[] }[] = [
  {
    title: "Life",
    properties: [
      "parentage",
      "birthPlace",
      "deme",
      "birthDate",
      "education",
      "studiedUnder",
      "affiliatedWith",
      "livedIn",
      "traveledTo",
      "oldAge",
    ],
  },
  {
    title: "Death",
    properties: ["deathDate", "deathPlace", "mannerOfDeath"],
  },
  {
    title: "Works",
    properties: ["writings", "wrote"],
  },
  {
    title: "Doctrines",
    properties: ["heldDoctrine"],
  },
  {
    title: "Judgements",
    properties: ["praised", "criticized"],
  },
];

const PROPERTY_LABEL: Record<string, string> = {
  parentage: "Family",
  birthPlace: "Born in",
  birthDate: "Born",
  education: "Education",
  studiedUnder: "Studied under",
  affiliatedWith: "School",
  livedIn: "Lived in",
  traveledTo: "Traveled to",
  oldAge: "Old age",
  deme: "Deme",
  deathDate: "Died",
  deathPlace: "Died in",
  mannerOfDeath: "Death",
  writings: "Writings",
  wrote: "Wrote",
  heldDoctrine: "Doctrine",
  praised: "Praised",
  criticized: "Criticized",
  succession: "Succession",
};

const WORKS_PREVIEW = 8;

function CitationLink({ claim }: { claim: Claim }) {
  const label = `D.L. ${claim.ref}`;
  if (!claim.sectionId) {
    return <span className="text-xs text-muted-foreground">({label})</span>;
  }
  return (
    <Link
      href={`/section/${claim.sectionId}`}
      className="text-xs text-primary hover:underline whitespace-nowrap"
      title="Read this passage"
    >
      ({label})
    </Link>
  );
}

const GREEK_AUTO_HIDE = 7;

function ClaimLine({ claim, showGreek }: { claim: Claim; showGreek: boolean }) {
  const badge = certaintyBadge(claim);
  const transmission = transmissionBadge(claim);
  return (
    <li className="text-sm leading-snug">
      <span className="text-foreground">{claim.value}</span>
      {claim.greek && (
        <span className="ml-1 font-serif italic text-muted-foreground">
          (<span lang="grc">{claim.greek}</span>)
        </span>
      )}{" "}
      <CitationLink claim={claim} />
      {badge && (
        <span
          className={`ml-1.5 inline-block align-middle px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
      {transmission && (
        <span
          className={`ml-1.5 inline-block align-middle px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 ${transmission.className}`}
          title="How the text reports this work has come down to us"
        >
          {transmission.label}
        </span>
      )}
      {claim.altTitle && (
        <span className="block text-xs text-muted-foreground">
          also titled <span className="italic">{claim.altTitle}</span>{" "}
          {claim.altTitleSectionId ? (
            <Link
              href={`/section/${claim.altTitleSectionId}`}
              className="text-primary hover:underline whitespace-nowrap"
              title="Read this passage"
            >
              (D.L. {claim.altTitleRef})
            </Link>
          ) : (
            <span>(D.L. {claim.altTitleRef})</span>
          )}
        </span>
      )}
      {hasSourceText(claim) && showGreek && (
        <span className="block mt-1 pl-2.5 border-l-2 border-primary/30">
          <span className="block text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
            Source text
          </span>
          <span
            lang="grc"
            className="block font-serif text-sm text-foreground/80 break-words"
          >
            {claim.grc}
          </span>
        </span>
      )}
      {hasAttribution(claim) && (
        <span className="block text-xs text-muted-foreground">
          according to{" "}
          {claim.accordingToUri ? (
            <Link
              href={`/entities?entity=${encodeURIComponent(claim.accordingToUri)}`}
              className="text-primary hover:underline"
              title="Open this authority in the Index"
            >
              {claim.accordingTo}
            </Link>
          ) : (claim.accordingTo)}
          {claim.sourceWork && (
            <>
              , asserted in{" "}
              {claim.sourceWorkUri ? (
                <Link
                  href={`/entities?entity=${encodeURIComponent(claim.sourceWorkUri)}`}
                  className="italic text-primary hover:underline"
                  title="Open this work in the Index"
                >
                  {claim.sourceWork}
                </Link>
              ) : (
                <span className="italic">{claim.sourceWork}</span>
              )}
            </>
          )}
        </span>
      )}
      {hasChain(claim) && (
        <span className="block text-xs text-muted-foreground">
          via{" "}
          {(claim.chain ?? []).map((l, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {l.authorityUri ? (
                <Link
                  href={`/entities?entity=${encodeURIComponent(l.authorityUri)}`}
                  className="text-primary hover:underline"
                  title="Open this authority in the Index"
                >
                  {l.authority}
                </Link>
              ) : (
                l.authority
              )}
              {l.work && (
                <>
                  {" ("}
                  {l.workUri ? (
                    <Link
                      href={`/entities?entity=${encodeURIComponent(l.workUri)}`}
                      className="italic text-primary hover:underline"
                      title="Open this work in the Index"
                    >
                      {l.work}
                    </Link>
                  ) : (
                    <span className="italic">{l.work}</span>
                  )}
                  {")"}
                </>
              )}
            </span>
          ))}
        </span>
      )}
      {claim.note && (
        <span className="block text-xs text-muted-foreground italic">
          {grcSpans(claim.note)}
        </span>
      )}
    </li>
  );
}

export default function ClaimsPanel({
  philosopher,
  collapsible = false,
  defaultOpen = false,
}: {
  philosopher: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const { data, isLoading } = useGetPhilosopherClaims(philosopher);
  const [worksExpanded, setWorksExpanded] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [greekOverride, setGreekOverride] = useGreekSourcePref();

  const greekCount = useMemo(
    () => (data?.claims ?? []).filter((c) => c.grc).length,
    [data],
  );
  const showGreek = greekOverride ?? greekCount <= GREEK_AUTO_HIDE;

  const byProperty = useMemo(() => {
    const map = new Map<string, Claim[]>();
    for (const c of data?.claims ?? []) {
      const list = map.get(c.property) ?? [];
      list.push(c);
      map.set(c.property, list);
    }
    return map;
  }, [data]);

  if (isLoading) {
    if (collapsible) return null;
    return <div className="h-16 bg-muted rounded-lg animate-pulse" />;
  }
  if (!data || data.claims.length === 0) return null;

  const greekToggle = greekCount > 0 && (
    <button
      onClick={() => setGreekOverride(!showGreek)}
      className="text-xs text-primary hover:underline"
      aria-pressed={showGreek}
    >
      {showGreek
        ? "Hide Greek source text"
        : `Show Greek source text (${greekCount})`}
    </button>
  );

  const body = (
    <>
      {greekToggle && <div className="flex justify-end -mb-1">{greekToggle}</div>}
      {GROUPS.map((group) => {
        const rows = group.properties
          .map((p) => [p, byProperty.get(p) ?? []] as const)
          .filter(([, claims]) => claims.length > 0);
        if (rows.length === 0) return null;

        if (group.title === "Works") {
          const all = rows.flatMap(([, claims]) => claims);
          const shown = worksExpanded ? all : all.slice(0, WORKS_PREVIEW);
          return (
            <div key={group.title} className="space-y-1">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h4>
              <ul className="space-y-1.5">
                {shown.map((c) => (
                  <ClaimLine key={c.id} claim={c} showGreek={showGreek} />
                ))}
              </ul>
              {all.length > WORKS_PREVIEW && (
                <button
                  onClick={() => setWorksExpanded((v) => !v)}
                  className="text-xs text-primary hover:underline"
                >
                  {worksExpanded
                    ? "Show fewer"
                    : `Show all ${all.length} entries`}
                </button>
              )}
            </div>
          );
        }

        return (
          <div key={group.title} className="space-y-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </h4>
            <ul className="space-y-1.5">
              {rows.map(([property, claims]) => (
                <li key={property}>
                  <span className="text-xs text-muted-foreground">
                    {PROPERTY_LABEL[property] ?? property}
                  </span>
                  <ul className="space-y-1.5 mt-0.5">
                    {claims.map((c) => (
                      <ClaimLine key={c.id} claim={c} showGreek={showGreek} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );

  if (collapsible) {
    return (
      <div className="border-t border-border mt-8 pt-8">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
          aria-expanded={open}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            From the text
          </span>
          <span className="text-xs text-primary">
            {open ? "Hide" : `Show ${data.claims.length} facts`}
          </span>
        </button>
        {open && <div className="px-6 pb-6 space-y-3">{body}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        From the text
      </h3>
      {body}
    </div>
  );
}
