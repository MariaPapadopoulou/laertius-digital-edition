#!/usr/bin/env python3
"""
ingest-tei.py — replicable TEI -> JSONL pipeline for the Laertius corpus.

Regenerates artifacts/api-server/data/laertius_sections.jsonl and
laertius_sections_en.jsonl from the pinned Perseus TEI editions
(tlg0004.tlg001.perseus-grc2.xml / perseus-eng2.xml), using only the
Python standard library so the run is reproducible anywhere.

Transformation rules (documented in docs/tei-pipeline.md):
  1. Segmentation follows the CTS structure the TEI header declares:
     body div -> book div -> chapter div -> section div, each keyed by
     its @n attribute. Section id = "book.chapter.section"; the URN is
     the edition urn plus ":" plus that id.
  2. <note> subtrees (critical apparatus / editorial notes) are dropped
     entirely; the note's tail text is kept.
  3. All other elements are transparent: their text content stays in
     the reading flow (quotes, verse lines, titles, foreign, etc.).
  4. Flattening: text/tail fragments are collected in document order;
     each fragment is whitespace-collapsed and stripped; non-empty
     fragments are joined with a single space.
  5. No Unicode transformation is applied: the TEI already carries the
     canonical (NFC-compatible) forms the corpus uses.
  6. Chapter-level curator metadata (philosopher, school) comes from
     artifacts/api-server/data/tei-chapter-metadata.json.

Modes:
  --check (default)  regenerate in memory and compare against the
                     checked-in JSONL files; exits non-zero on drift.
  --write OUTDIR     write regenerated JSONL files into OUTDIR.

Known quirks of the original (pre-pipeline) generator, pinned so drift
is still caught everywhere else:
  * WS_ONLY_QUIRKS: sections whose checked-in text differs from the
    rule-generated text only in whitespace placement.
  * REAL_QUIRKS: sections where the original generator leaked apparatus
    note text into the corpus (grc 4.1.5, 9.8.51) or dropped a trailing
    quote (en 7.1.64). The checked-in corpus is the serving authority,
    so these are recorded, not "fixed" here.

Run: pnpm --filter @workspace/scripts run validate-tei-ingest
"""

import argparse
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "{http://www.tei-c.org/ns/1.0}"
HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "artifacts" / "api-server" / "data"
GRC_XML = DATA / "tlg0004.tlg001.perseus-grc2.xml"
ENG_XML = DATA / "tlg0004.tlg001.perseus-eng2.xml"
GRC_JSONL = DATA / "laertius_sections.jsonl"
ENG_JSONL = DATA / "laertius_sections_en.jsonl"
META_JSON = DATA / "tei-chapter-metadata.json"
GRC_URN_BASE = "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2"

# Sections where the checked-in corpus differs from the documented rules
# only in whitespace placement (original-generator artifact).
WS_ONLY_QUIRKS = {
    "1.1.24", "5.1.11", "5.1.12", "5.1.19", "5.1.21",
    "9.5.25", "9.11.84", "10.1.75", "10.1.88", "10.1.90",
}
# Sections with substantive divergence from the rules (see module docstring).
REAL_QUIRKS_GRC = {"4.1.5", "9.8.51"}
REAL_QUIRKS_EN = {"7.1.64"}
# Exact serving-corpus text for every quirk section, so a quirk cannot
# silently mutate into some OTHER divergence and still pass.
FIXTURES = json.loads((HERE / "tei-quirk-fixtures.json").read_text(encoding="utf-8"))


def collect_fragments(el, out):
    """Depth-first text/tail collection, dropping <note> subtrees."""
    if el.tag == NS + "note":
        if el.tail:
            out.append(el.tail)
        return
    if el.text:
        out.append(el.text)
    for child in el:
        collect_fragments(child, out)
    if el.tail:
        out.append(el.tail)


def flatten_section(sec):
    out = []
    if sec.text:
        out.append(sec.text)
    for child in sec:
        collect_fragments(child, out)
    normalized = (re.sub(r"\s+", " ", frag).strip() for frag in out)
    return " ".join(frag for frag in normalized if frag)


def iter_sections(xml_path):
    body = ET.parse(xml_path).getroot().find(f".//{NS}text/{NS}body/{NS}div")
    if body is None:
        raise SystemExit(f"FAIL: no body edition div in {xml_path}")
    for book in body.findall(NS + "div"):
        for chapter in book.findall(NS + "div"):
            for section in chapter.findall(NS + "div"):
                yield book.get("n"), chapter.get("n"), section.get("n"), section


def generate():
    meta = json.loads(META_JSON.read_text(encoding="utf-8"))
    grc_rows, eng_rows = [], []
    for book, chapter, section, el in iter_sections(GRC_XML):
        sid = f"{book}.{chapter}.{section}"
        m = meta.get(f"{book}.{chapter}")
        if m is None:
            raise SystemExit(f"FAIL: no chapter metadata for {book}.{chapter}")
        text = flatten_section(el)
        grc_rows.append({
            "id": sid,
            "urn": f"{GRC_URN_BASE}:{sid}",
            "book": int(book),
            "chapter": chapter,
            "section": section,
            "philosopher": m["philosopher"],
            "school": m["school"],
            "text": text,
            "n_chars": len(text),
        })
    for book, chapter, section, el in iter_sections(ENG_XML):
        eng_rows.append({
            "id": f"{book}.{chapter}.{section}",
            "textEn": flatten_section(el),
        })
    return grc_rows, eng_rows


def load_jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def strip_ws(s):
    return re.sub(r"\s+", "", s)


def compare(label, generated, existing, text_key, ws_quirks, real_quirks, fixtures):
    """Compare generated rows against the checked-in corpus. Returns failures."""
    failures = []
    # Row-shape assertions first: unique ids, identical count and order.
    gen_ids = [r["id"] for r in generated]
    old_ids = [r["id"] for r in existing]
    if len(set(gen_ids)) != len(gen_ids):
        failures.append(f"{label}: duplicate ids in regenerated rows")
    if len(set(old_ids)) != len(old_ids):
        failures.append(f"{label}: duplicate ids in checked-in corpus")
    if len(gen_ids) != len(old_ids):
        failures.append(f"{label}: row count {len(gen_ids)} != checked-in {len(old_ids)}")
    elif gen_ids != old_ids:
        failures.append(f"{label}: section ordering differs from checked-in corpus")
    gen_by_id = {r["id"]: r for r in generated}
    old_by_id = {r["id"]: r for r in existing}
    missing = sorted(set(old_by_id) - set(gen_by_id))
    extra = sorted(set(gen_by_id) - set(old_by_id))
    if missing:
        failures.append(f"{label}: ids missing from regeneration: {missing[:5]}")
    if extra:
        failures.append(f"{label}: ids not in checked-in corpus: {extra[:5]}")
    exact = ws_only_seen = real_seen = 0
    for sid, old in old_by_id.items():
        gen = gen_by_id.get(sid)
        if gen is None:
            continue
        a, b = gen[text_key], old[text_key]
        if sid in ws_quirks or sid in real_quirks:
            # Quirk sections are exact fixtures: the serving text must match
            # the pinned snapshot verbatim, not merely "differ somehow".
            if b != fixtures.get(sid):
                failures.append(f"{label}: quirk section {sid} no longer matches its pinned fixture")
        if a == b:
            exact += 1
            if sid in ws_quirks or sid in real_quirks:
                failures.append(f"{label}: {sid} pinned as a quirk but now matches exactly; unpin it")
        elif strip_ws(a) == strip_ws(b):
            ws_only_seen += 1
            if sid not in ws_quirks:
                failures.append(f"{label}: unexpected whitespace divergence in {sid}")
        else:
            real_seen += 1
            if sid not in real_quirks:
                failures.append(f"{label}: substantive text divergence in {sid}")
        if text_key == "text":
            # n_chars tracks the text, so only compare it when the text matches
            fields = ("urn", "book", "chapter", "section", "philosopher", "school")
            if a == b:
                fields += ("n_chars",)
            for key in fields:
                if gen[key] != old[key]:
                    failures.append(f"{label}: {sid} field {key}: {gen[key]!r} != {old[key]!r}")
    print(f"{label}: {exact} exact, {ws_only_seen} whitespace-quirk, {real_seen} pinned-quirk, "
          f"{len(old_by_id)} total")
    if exact == 0:
        failures.append(f"{label}: zero exact matches; comparison is vacuous")
    return failures


def positive_control(generated, existing):
    """Prove the comparator flags a seeded defect (non-vacuity)."""
    mutated = [dict(r) for r in generated]
    seeded_id = mutated[0]["id"]
    mutated[0] = dict(mutated[0], text=mutated[0]["text"] + " SEEDED-DEFECT")
    f = compare("positive-control", mutated, existing, "text", WS_ONLY_QUIRKS, REAL_QUIRKS_GRC, FIXTURES["grc"])
    if not any(f"substantive text divergence in {seeded_id}" in msg for msg in f):
        return [f"positive control failed: seeded defect in {seeded_id} was not specifically flagged"]
    return []


def check_nfc(rows, text_key, label):
    bad = [r["id"] for r in rows if unicodedata.normalize("NFC", r[text_key]) != r[text_key]]
    if bad:
        return [f"{label}: regenerated text not NFC in {bad[:5]}"]
    return []


def apply_fixtures(grc_rows, eng_rows):
    """Patch quirk sections to the pinned serving text so --write output is
    the exact serving corpus, not a rules-only approximation."""
    for r in grc_rows:
        if r["id"] in FIXTURES["grc"]:
            r["text"] = FIXTURES["grc"][r["id"]]
            r["n_chars"] = len(r["text"])
    for r in eng_rows:
        if r["id"] in FIXTURES["en"]:
            r["textEn"] = FIXTURES["en"][r["id"]]


def write_out(outdir, grc_rows, eng_rows):
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    grc_rows = [dict(r) for r in grc_rows]
    eng_rows = [dict(r) for r in eng_rows]
    apply_fixtures(grc_rows, eng_rows)
    with open(outdir / "laertius_sections.jsonl", "w", encoding="utf-8") as f:
        for r in grc_rows:
            f.write(json.dumps(r, ensure_ascii=False, separators=(", ", ": ")) + "\n")
    with open(outdir / "laertius_sections_en.jsonl", "w", encoding="utf-8") as f:
        for r in eng_rows:
            f.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    # Equivalence assertion: the materialized corpus must equal the serving one.
    for name, ref in (("laertius_sections.jsonl", GRC_JSONL), ("laertius_sections_en.jsonl", ENG_JSONL)):
        a = load_jsonl(outdir / name)
        b = load_jsonl(ref)
        if a != b:
            raise SystemExit(f"FAIL: --write output {name} is not row-equivalent to the serving corpus")
    print(f"wrote {len(grc_rows)} grc + {len(eng_rows)} en sections to {outdir} (verified equivalent to serving corpus)")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="compare against checked-in JSONL (default)")
    ap.add_argument("--write", metavar="OUTDIR", help="write regenerated JSONL files to OUTDIR")
    args = ap.parse_args()

    grc_rows, eng_rows = generate()

    if args.write:
        write_out(args.write, grc_rows, eng_rows)
        if not args.check:
            return

    failures = []
    failures += compare("grc", grc_rows, load_jsonl(GRC_JSONL), "text", WS_ONLY_QUIRKS, REAL_QUIRKS_GRC, FIXTURES["grc"])
    failures += compare("en", eng_rows, load_jsonl(ENG_JSONL), "textEn", set(), REAL_QUIRKS_EN, FIXTURES["en"])
    failures += check_nfc(grc_rows, "text", "grc")
    failures += positive_control(grc_rows, load_jsonl(GRC_JSONL))

    if failures:
        print(f"\nFAIL: {len(failures)} problem(s):")
        for f in failures[:20]:
            print(" -", f)
        sys.exit(1)
    print("OK: TEI pipeline reproduces the checked-in corpus (rules + pinned quirks); positive control flagged.")


if __name__ == "__main__":
    main()
