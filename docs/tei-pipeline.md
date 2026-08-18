# TEI ingestion pipeline

How the corpus files `laertius_sections.jsonl` and `laertius_sections_en.jsonl`
are derived from the pinned Perseus TEI editions, and how to reproduce them.

## Inputs (immutable)

| File | Role |
| --- | --- |
| `artifacts/api-server/data/tlg0004.tlg001.perseus-grc2.xml` | Greek edition (authoritative) |
| `artifacts/api-server/data/tlg0004.tlg001.perseus-eng2.xml` | English translation (R.D. Hicks) |
| `artifacts/api-server/data/tei-chapter-metadata.json` | Curated chapter metadata (philosopher, school) |

The TEI files are the Perseus CTS/EpiDoc editions of Diogenes Laertius
(`urn:cts:greekLit:tlg0004.tlg001`). They are never edited by hand.

## Pipeline

Script: `scripts/ingest-tei.py` (Python standard library only).

- `pnpm --filter @workspace/scripts run validate-tei-ingest` — regenerate in
  memory and verify against the checked-in JSONL (this is the gate check).
- `python3 scripts/ingest-tei.py --write OUTDIR` — materialize the regenerated
  files elsewhere.

### Segmentation

Follows the CTS scheme the TEI header declares (`cRefPattern`): the edition
`<div>` contains book divs, chapter divs, section divs, each keyed by `@n`.
Section id is `book.chapter.section` (e.g. `1.prol.1`, `2.103`); the URN is
the edition URN plus `:` plus the id. 1211 sections.

### Tag handling

| TEI element | Treatment |
| --- | --- |
| `<note>` | Dropped with its whole subtree (critical apparatus, editorial notes); tail text kept |
| `<p>`, `<q>`, `<quote>`, `<l>`, `<said>`, `<foreign>`, `<title>`, `<hi>`, `<bibl>` | Transparent: text stays in the reading flow |
| `<pb>`, `<lb>`, `<milestone>` | No text content; ignored structurally |
| `<head>` (book/chapter titles) | Outside section divs; not part of section text |

### Flattening

Text and tail fragments are collected in document order; each fragment is
whitespace-collapsed and stripped; non-empty fragments are joined with a
single space. No Unicode transformation is applied (the TEI already carries
the NFC forms the corpus uses; the check verifies NFC).

### Metadata

`philosopher` and `school` are curator decisions, not TEI content. They are
keyed per chapter in `tei-chapter-metadata.json` and stamped onto every
section of that chapter.

## Known quirks (pinned, not silently tolerated)

The corpus was originally produced by an earlier, unscripted process. The
documented rules reproduce it byte-for-byte except:

- **Whitespace-only placement** in 10 Greek sections (`1.1.24`, `5.1.11`,
  `5.1.12`, `5.1.19`, `5.1.21`, `9.5.25`, `9.11.84`, `10.1.75`, `10.1.88`,
  `10.1.90`).
- **Apparatus leakage**: Greek `4.1.5` and `9.8.51` contain fragments of
  editorial notes that the rules would drop.
- **Dropped tail**: English `7.1.64` is missing a trailing quoted clause that
  the rules would keep.

The checked-in JSONL remains the serving authority (annotations and offsets
are anchored to it), so these are recorded as pinned exceptions in
`ingest-tei.py`. If any of them starts matching, or a new divergence appears
anywhere else, the validator fails — either the corpus or the TEI moved.

## Replicating elsewhere

Everything needed is in the repository: pinned TEI, metadata, script, and
this rule table. `python3 scripts/ingest-tei.py --write out/` on any machine
with Python 3 reproduces the corpus (modulo the pinned quirks, which are
listed above precisely so a re-run is auditable).
