/**
 * TEDI-style HTML dictionaries of the ontoterminology.
 *
 * Reproduces the self-contained "Tedi HTML viewer" exports that TEDI 4.1
 * writes: one static page with the TEDI stylesheet, a search box over a
 * <select> list, and a display pane whose entries are prebuilt HTML
 * strings in a `dictionnaire` JS array. Two exports share the shell:
 *
 * Term Dictionary (terms.<lang>.html reference):
 *   - terminologyEntry (blue): term, Definition, part of speech, Status,
 *     plus the other-language equivalents that denote the same concept
 *   - conceptEntry (green): Concept <Id>, "a kind of" parent, and the
 *     axiomatized relations whose domain includes the concept's ancestry
 *     (the same filter routes/otb.ts applies for /api/otb/concepts)
 *   - objectEntry (grey): "All Objects of this type: N" then every object
 *     whose concept is exactly the denoted concept (no subtree walk, per
 *     the reference), with its proper names and allonyms in blue, the
 *     fragment id in bold, and "type:" the concept's short name
 *
 * Proper Name Dictionary (pn.<lang>.html reference):
 *   - one entry per proper-name surface; allonyms are first-class
 *     entries of their own (the reference lists Cleoboulos and Cleobulus
 *     separately, each naming the other in its "allonym(s)" line)
 *   - terminologyEntry: the name, "is a" with the term denoting the
 *     object's concept in blue (same language preferred), or the italic
 *     "there is no term denoting the concept <Id>" fallback, then the
 *     "allonym(s)" line with each allonym followed by ", "
 *   - objectEntry: "Denoted object: <fragment id>", "is a" with the
 *     concept in green, then optional Comment, attribute lines quoted as
 *     &apos;value&apos;, and relation lines whose target renders as its
 *     proper name when one exists, else as &apos; + fragment id (the
 *     reference prints 'socratics with no closing quote but "Socrates"
 *     plain, so the asymmetry is deliberate)
 *
 * Rules:
 *   - Pages must stay fully self-contained (inline CSS + JS, no external
 *     assets) so they work saved to disk, as TEDI exports do.
 *   - Output is deterministic: the only date is OTB_META.exportDate, so
 *     the IONOS bundle fingerprint does not churn between builds.
 *   - Both dictionaries ship in a combined variant (all languages, each
 *     alphabetical within its language block) and one file per language,
 *     as TEDI writes them: dictionary.en.html / dictionary.grc.html for
 *     the terms, proper-names.en.html /
 *     proper-names.grc.html for the proper names. Cross-language lines
 *     inside each entry (term Equivalents, allonyms in other languages)
 *     still render, as in the reference per-language exports.
 *   - Entry HTML is embedded via JSON string literals with "<" escaped
 *     (\u003c) so no "</script>" sequence can break the inline script.
 *
 * Served by routes/otb.ts as GET /api/otb/dictionary.html and
 * GET /api/otb/proper-names.html, linked from the Terminology section's
 * Overview, Proper Names, and About the Model pages.
 */
import { getOtbModel, OTB_META, type OtbModel, type OtbObject, type OtbProperName } from "./build";
import type { OtbTermDef } from "./inventory";
import { OTB_DEPICTIONS } from "./depictions";

export type OtbDictionaryLang = "en" | "grc";
export type OtbPnDictionaryLang = "en" | "grc";

const termCaches = new Map<string, string>();
const pnCaches = new Map<string, string>();

export function getOtbDictionaryHtml(lang?: OtbDictionaryLang): string {
  const key = lang ?? "all";
  let html = termCaches.get(key);
  if (html === undefined) {
    html = buildDictionaryHtml(getOtbModel(), lang);
    termCaches.set(key, html);
  }
  return html;
}

export function getOtbProperNamesDictionaryHtml(
  lang?: OtbPnDictionaryLang,
): string {
  const key = lang ?? "all";
  let html = pnCaches.get(key);
  if (html === undefined) {
    html = buildProperNamesHtml(getOtbModel(), lang);
    pnCaches.set(key, html);
  }
  return html;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Thumbnail plus credit link for an object's curated Wikimedia Commons
 * depiction (Wikidata P18, fetched at curation time into depictions.ts).
 * Returns "" when the object has none; the credit line links the Commons
 * file page so the freely licensed image stays attributed.
 */
function depictionHtml(
  objectId: string,
  alt: string,
  maxWidth: number,
  maxHeight: number,
): string {
  const dep = OTB_DEPICTIONS[objectId];
  if (!dep) return "";
  const credit = dep.artist
    ? `${dep.artist}, Wikimedia Commons (${dep.license})`
    : `Wikimedia Commons (${dep.license})`;
  return `<div class="textMediumMargin"><img src="${esc(dep.url)}" alt="${esc(alt)}" style="max-width:${maxWidth}px;max-height:${maxHeight}px;border-radius:4px;display:block;"/><a href="${esc(dep.page)}" target="_blank" rel="noopener"><i>Image: ${esc(credit)}</i></a></div>`;
}

/** "22/07/2026" -> "July 22, 2026" (the reference prints the long form). */
function longDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[Number(mm) - 1] ?? mm;
  return `${month} ${Number(dd)}, ${yyyy}`;
}

function conceptRef(id: string): string {
  return `&lt;${esc(id)}&gt;`;
}

function buildTermEntry(m: OtbModel, term: OtbTermDef): string {
  const conceptById = new Map(m.concepts.map((c) => [c.id, c]));
  const nameById = new Map(m.properNames.map((n) => [n.id, n]));
  const concept = conceptById.get(term.concept);
  const parts: string[] = [];

  // Terminology entry (linguistic level).
  parts.push('<div class="terminologyEntry">');
  parts.push(`<div class="term">${esc(term.name)}</div>`);
  if (term.definition) {
    parts.push(
      `<div class="definitionNL"><b>Definition</b>: ${esc(term.definition)}</div>`,
    );
  }
  if (term.partOfSpeech !== "none") {
    const gender = term.gender !== "none" ? `, ${esc(term.gender)}` : "";
    parts.push(
      `<div class="textMediumMargin"><b>Part of speech</b>: ${esc(term.partOfSpeech)}${gender}</div>`,
    );
  }
  parts.push(
    `<div class="textMediumMargin"><b>Status</b>: ${esc(term.status)}</div>`,
  );
  if (term.lsj) {
    parts.push(
      `<div class="textMediumMargin"><b>LSJ</b>: <a href="${esc(term.lsj)}" target="_blank" rel="noopener">${esc(term.lsj)}</a></div>`,
    );
  }
  if (term.wikidata) {
    parts.push(
      `<div class="textMediumMargin"><b>Wikidata lexeme</b>: <a href="${esc(term.wikidata)}" target="_blank" rel="noopener">${esc(term.wikidata)}</a></div>`,
    );
  }
  for (const other of m.terms) {
    if (other.concept !== term.concept || other.id === term.id) continue;
    parts.push(
      `<div class="equivalent"><b>Equivalent (${esc(other.lang)})</b>: ${esc(other.name)}</div>`,
    );
  }
  parts.push("</div>");

  // Concept entry (conceptual level).
  parts.push('<div class="conceptEntry">');
  parts.push(
    `<div class="concept"><b>Concept</b>: ${conceptRef(term.concept)}</div>`,
  );
  if (concept?.isA) {
    parts.push(
      `<div class="definitionFormal"><b>a kind of</b>: ${conceptRef(concept.isA)}</div>`,
    );
  }
  const ancestry: string[] = [term.concept];
  let cur = concept;
  while (cur?.isA) {
    ancestry.push(cur.isA);
    cur = conceptById.get(cur.isA);
  }
  const relations = m.relations.filter(
    (r) => r.axiomatized && r.domain.some((d) => ancestry.includes(d)),
  );
  if (relations.length > 0) {
    parts.push('<div class="definitionFormal"><b>relation(s): </b> </div>');
    for (const r of relations) {
      const ranges = r.range.map(conceptRef).join(", ");
      parts.push(
        `<div class="definitionFormal"> <u><i>${esc(r.id)}</i></u>: ${ranges}</div>`,
      );
    }
  }
  parts.push("</div>");

  parts.push('<div class="otherEntry"></div>');

  // Object roster: direct instances of the denoted concept only.
  const objects = m.objects
    .filter((o) => o.concept === term.concept)
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  parts.push(
    `<div class="objectEntry"><div class="titleBlack"><strong>All Objects of this type: ${objects.length}</strong></div></div>`,
  );
  const typeName = concept?.shortName ?? term.concept;
  for (const o of objects) {
    parts.push('<div class="objectEntry">');
    // Allonyms are ids of other proper-name records: resolve to surfaces
    // and dedupe (a name and its allonym reference each other).
    const seen = new Set<string>();
    const names: string[] = [];
    for (const nid of o.names) {
      const n = nameById.get(nid);
      if (!n) continue;
      for (const surface of [
        n.name,
        ...n.allonyms.map((aid) => nameById.get(aid)?.name ?? ""),
      ]) {
        if (surface === "" || seen.has(surface)) continue;
        seen.add(surface);
        names.push(surface);
      }
    }
    if (names.length > 0) {
      parts.push(
        `<div class=textMediumMarginBlue>proper name: ${names.map(esc).join(", ")}, </div>`,
      );
    } else if (o.label !== o.id) {
      parts.push(`<div class=textMediumMarginBlue>${esc(o.label)}</div>`);
    }
    parts.push(
      `<div class="textMediumMargin"><strong>${esc(o.id)}</strong></div>`,
    );
    parts.push(
      `<div class="textMediumMargin">type: ${esc(typeName)}</div>`,
    );
    // Smaller thumbnail than the proper name dictionary's: the roster
    // can list hundreds of objects per term entry.
    const rosterDep = depictionHtml(o.id, o.label, 150, 110);
    if (rosterDep !== "") parts.push(rosterDep);
    parts.push("</div>");
  }

  return parts.join("");
}

/** One display row of the Proper Name Dictionary (a name or an allonym). */
interface PnRow {
  surface: string;
  lang: string;
  html: string;
}

function buildPnRows(m: OtbModel): PnRow[] {
  const objectById = new Map(m.objects.map((o) => [o.id, o]));
  const nameById = new Map(m.properNames.map((n) => [n.id, n]));
  const namesByObject = new Map<string, OtbProperName[]>();
  for (const n of m.properNames) {
    const arr = namesByObject.get(n.object);
    if (arr) arr.push(n);
    else namesByObject.set(n.object, [n]);
  }

  const termFor = (concept: string, lang: string): OtbTermDef | undefined => {
    const cands = m.terms.filter((t) => t.concept === concept);
    return (
      cands.find((t) => t.lang === lang && t.status === "preferred") ??
      cands.find((t) => t.lang === lang) ??
      cands.find((t) => t.status === "preferred") ??
      cands[0]
    );
  };

  // A relation target renders as its proper name (same language first,
  // then English) when one exists, else as &apos; + fragment id, per the
  // reference.
  const targetRef = (target: string, lang: string): string => {
    const cands = namesByObject.get(target) ?? [];
    const n =
      cands.find((c) => c.lang === lang) ??
      cands.find((c) => c.lang === "en") ??
      cands[0];
    return n ? esc(n.name) : `&apos;${esc(target)}`;
  };

  const buildEntry = (
    surface: string,
    allonyms: string[],
    n: OtbProperName,
    o: OtbObject,
  ): string => {
    const parts: string[] = [];
    parts.push('<div class="terminologyEntry">');
    parts.push(`<div class="term">${esc(surface)}</div>`);
    const t = termFor(o.concept, n.lang);
    if (t) {
      parts.push(
        `<div class="textMediumMargin"><b>is a</b>: <font color="blue">${esc(t.name)}</font></div>`,
      );
    } else {
      parts.push(
        `<div class="textMediumMargin"><b>is a</b>: <i>there is no term denoting the concept </i>${conceptRef(o.concept)}</div>`,
      );
    }
    if (allonyms.length > 0) {
      parts.push(
        `<div class="textMediumMargin"><b>allonym(s)</b>: <font color="blue">${allonyms.map((a) => `${esc(a)}, `).join("")}</font></div>`,
      );
    }
    parts.push("</div>");

    parts.push('<div class="objectEntry">');
    parts.push(
      `<div class="objectEntry"><b>Denoted object</b>: ${esc(o.id)}</div>`,
    );
    parts.push(
      `<div class="textMediumMargin"><b>is a</b>: <font color="green">${conceptRef(o.concept)}</font></div>`,
    );
    const depBlock = depictionHtml(o.id, o.label, 250, 180);
    if (depBlock !== "") parts.push(depBlock);
    parts.push('<div class="textMediumMargin">');
    if (o.note) {
      parts.push(`<div class="objectEntry"><b>Comment</b>: ${esc(o.note)}</div>`);
    }
    if (o.literals.length > 0) {
      parts.push('<div class="objectEntry">');
      for (const l of o.literals) {
        parts.push(
          `<div class="attributeIndividual"> <u>${esc(l.attr)}</u>: &apos;${esc(l.value)}&apos;</div>`,
        );
      }
      parts.push("</div>");
    }
    if (o.relations.length > 0) {
      parts.push('<div class="objectEntry">');
      for (const r of o.relations) {
        parts.push(
          `<div class="attributeIndividual"> <u>${esc(r.rel)}</u>: ${targetRef(r.target, n.lang)}</div>`,
        );
      }
      parts.push("</div>");
    }
    parts.push("</div>");
    parts.push("</div>");
    return parts.join("");
  };

  // One row per proper-name record; allonyms are ids of other records
  // (which get rows of their own, as in the reference), so the
  // "allonym(s)" line resolves them to their surfaces.
  const rows: PnRow[] = [];
  for (const n of m.properNames) {
    const o = objectById.get(n.object);
    if (!o) continue;
    const allonyms = n.allonyms
      .map((aid) => nameById.get(aid)?.name)
      .filter((s): s is string => s !== undefined && s !== n.name);
    rows.push({
      surface: n.name,
      lang: n.lang,
      html: buildEntry(n.name, allonyms, n, o),
    });
  }
  return rows;
}

function buildProperNamesHtml(m: OtbModel, lang?: OtbPnDictionaryLang): string {
  const rows = buildPnRows(m);
  const en = rows
    .filter((r) => r.lang === "en")
    .sort((a, b) => a.surface.localeCompare(b.surface, "en"));
  const grc = rows
    .filter((r) => r.lang !== "en")
    .sort((a, b) => a.surface.localeCompare(b.surface, "el"));
  const shown = lang === "en" ? en : lang === "grc" ? grc : [...en, ...grc];
  const langLabel = lang ?? "en, grc";

  const options = shown
    .map((r, i) => `                <option value="${i}">${esc(r.surface)}</option>`)
    .join("\n");
  const entries = shown
    .map((r) => `    [${JSON.stringify(r.html).replace(/</g, "\\u003c")}]`)
    .join(",\n");

  const header = `<div class="title1">Proper Name Dictionary on "${esc(OTB_META.title)}" (${langLabel})</div>
<div class="textMedium">TEDI Version: 4.1 - Date: ${esc(longDate(OTB_META.exportDate))} - <a href="http://ontoterminology.com/tedi" target="_blank" rel="noopener"><b>www.ontoterminology.com/tedi</b></a></div>
<br/>`;

  return viewerPage(header, options, entries);
}

function buildDictionaryHtml(m: OtbModel, lang?: OtbDictionaryLang): string {
  const en = m.terms
    .filter((t) => t.lang === "en")
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const grc = m.terms
    .filter((t) => t.lang === "grc")
    .sort((a, b) => a.name.localeCompare(b.name, "el"));
  const terms = lang === "en" ? en : lang === "grc" ? grc : [...en, ...grc];
  const langLabel = lang ?? "en, grc";

  const options = terms
    .map((t, i) => `                <option value="${i}">${esc(t.name)}</option>`)
    .join("\n");
  const entries = terms
    .map(
      (t) =>
        `    [${JSON.stringify(buildTermEntry(m, t)).replace(/</g, "\\u003c")}]`,
    )
    .join(",\n");

  const header = `<div class="title1">Term Dictionary on "${esc(OTB_META.title)}" (${langLabel})</div>
<div class="textMedium">TEDI Version: 4.1 - Date: ${esc(longDate(OTB_META.exportDate))} - <a href="http://ontoterminology.com/tedi" target="_blank" rel="noopener">www.ontoterminology.com/tedi</a><br/>
Number of terms: ${terms.length} - Number of concepts: ${m.concepts.length} - Number of objects: ${m.objects.length}</div>`;

  return viewerPage(header, options, entries);
}

/** The shared TEDI viewer shell (stylesheet, search box, display pane). */
function viewerPage(header: string, options: string, entries: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN">
<html>
<head>
    <title>Tedi HTML viewer</title>
    <meta charset="UTF-8">
    <style type="text/css">
        body {
            font-family: Arial, Georgia, Times, serif;
            color:black;
            background-color: white
        }
        .terminologyEntry{
            margin-bottom: 5px;
            margin-left: 2px;
            background-color: #CBEFFF;
            box-sizing: border-box;
            box-shadow: 0 0 50px 0 rgba(0,0,0,0.1) inset;
            -webkit-border-radius: 10px;
            -moz-border-radius: 10px;
            border-radius: 8px;
            padding: 5px 5px;
        }
        .conceptEntry{
            margin-bottom: 5px;
            margin-left: 2px;
            background-color: #D8FFEC;
            box-sizing: border-box;
            box-shadow: 0 0 50px 0 rgba(0,0,0,0.1) inset;
            -webkit-border-radius: 10px;
            -moz-border-radius: 10px;
            border-radius: 8px;
            padding: 5px 5px;
        }
        .objectEntry{
            margin-bottom: 5px;
            margin-left: 2px;
            background-color: #EFEFEF;
            box-sizing: border-box;
            box-shadow: 0 0 50px 0 rgba(0,0,0,0.1) inset;
            -webkit-border-radius: 10px;
            -moz-border-radius: 10px;
            border-radius: 8px;
        }
        .otherEntry{
            margin-bottom: 5px;
            margin-left: 2px;
            background-color: white;
            box-sizing: border-box;
            box-shadow: 0 0 50px 0 rgba(0,0,0,0.1) inset;
            border: thick;
            -webkit-border-radius: 10px;
            -moz-border-radius: 10px;
            border-radius: 8px;
        }
        select option {
            margin-bottom: 5px;
            background-color: darkblue;
            color: white;
            font-weight: bold;
            border-radius: 8px;
            border: 1px solid transparent;
        }
        option:checked {
            background-color: #CBEFFF !important;
            color:blue !important;
        }
        select  {
            margin-bottom: 5px;
            background-color: white;
            border-radius: 8px;
            border: 1px solid transparent;
             width: 20vw !important;
        }
        select:focus {
            outline: none !important;
            box-shadow: none !important;
        }
        .title1{
            color:#8B0000;
            text-align:center;
            font-weight: bold;
            font-size: 175%;
            margin-bottom: 5px;
            background-color: #EFEFEF;
            box-sizing: border-box;
            box-shadow: 0 0 50px 0 rgba(0,0,0,0.1) inset;
            -webkit-border-radius: 10px;
            -moz-border-radius: 10px;
            border-radius: 8px;
            padding: 5px 5px;
        }
        .textMedium{
            color:black;
            font-size: 85%;
            margin-bottom: 2px;
        }
        .textMediumMargin{
            color:black;
            font-size: 85%;
            margin-left: 10px;
            margin-bottom: 2px;
        }
        .textMediumMarginBlue{
            color:blue;
            font-size: 85%;
            margin-left: 10px;
            margin-bottom: 2px;
        }
        .textItalicSmallMargin{
            color:black;
            font-style: italic;
            font-size: 80%;
            margin-left: 10px;
            margin-bottom: 2px;
        }
        .subTitleItalicSmallBlack{
            color:black;
            font-style: italic;
            font-size: 85%;
            margin-left: 10px;
            margin-bottom: 2px;
        }
        .subTitleItalicSmallGreen{
            color:green;
            font-style: italic;
            font-size: 85%;
            margin-left: 10px;
            margin-bottom: 2px;
        }
        .subTitleGreen{
            color:green;
            font-size: 100%;
            margin-left: 5px;
            margin-bottom: 2px;
        }
        .term{
            color:blue;
            margin-left: 5px;
            font-weight: bold;
            font-size: 115%;
            margin-bottom: 5px;
        }
        .titleBlack{
            color:black;
            margin-left: 5px;
            font-size: 100%;
            margin-bottom: 5px;
        }
        .definitionNL{
            color:blue;
            margin-left: 10px;
            font-size: 95%;
            margin-bottom: 2px;
        }
        .note{
            color:black;
            font-style: italic;
            margin-left: 10px;
            font-size: 85%;
            margin-bottom: 2px;
        }
        .context{
            color:black;
            font-style: italic;
            margin-left: 10px;
            font-size: 85%;
            margin-bottom: 2px;
        }
        .equivalent{
            color:black;
            font-style: italic;
            margin-left: 10px;
            font-size: 85%;
            margin-bottom: 2px;
        }
        .concept{
            color:green;
            margin-left: 10px;
            font-size: 85%;
            margin-bottom: 2px;
        }
        .externalLink{
            color:green;
            margin-left: 10px;
            font-style: italic;
            font-size: 80%;
            margin-bottom: 2px;
        }
        .externalLinkTerm{
            color:blue;
            margin-left: 10px;
            font-style: italic;
            font-size: 80%;
            margin-bottom: 2px;
        }
        .externalLinkIndividual{
            color:black;
            margin-left: 10px;
            font-style: italic;
            font-size: 80%;
            margin-bottom: 2px;
        }
        .attributeIndividual{
            color:black;
            margin-left: 10px;
            font-size: 90%;
            margin-bottom: 2px;
        }
        .definitionFormal{
            color:green;
            margin-left: 10px;
            font-size: 85%;
            margin-bottom: 2px;
        }
    </style>
</head>
<body>
${header}
<table style="width:100%" border="0">
    <tr>
        <td style="width:20%" valign="top">
            <table><tr><td><div class="textMedium">search:</div></td><td><input type="search" id="searchBox" style="width:100%; font-size:85%"/></td></tr></table>
            <select id="idTerm" style="width:100%; font-size:85%" size="25">
${options}
            </select>
        </td>
        <td style="width:80%" valign="top">
            <div id="display"></div>
        </td>
    </tr>
</table>
<script language="JavaScript">
var dictionnaire = [
${entries}
];
function show_selected() {
    var selector = document.getElementById('idTerm');
    var champ = dictionnaire[selector[selector.selectedIndex].value][0];
    document.getElementById('display').innerHTML = champ;
}
document.getElementById('idTerm').addEventListener('change', show_selected);

searchBox = document.querySelector("#searchBox");
entries = document.querySelector("#idTerm");
var when = "keyup"; //You can change this to keydown, keypress or change

searchBox.addEventListener("keyup", function (e) {
    var text = e.target.value;
    var options = entries.options;
    for (var i = 0; i < options.length; i++) {
        var option = options[i];
        var optionText = option.text;
        var lowerOptionText = optionText.toLowerCase();
        var lowerText = text.toLowerCase();
        var regex = new RegExp("^" + text, "i");
        var match = optionText.match(regex);
        var contains = lowerOptionText.indexOf(lowerText) != -1;
        if (match || contains) {
            option.selected = true;
            show_selected();
            return;
        }
        searchBox.selectedIndex = 0;
    }
});

document.getElementById('idTerm').selectedIndex = 0;
show_selected();
</script>
</body>
</html>
`;
}
