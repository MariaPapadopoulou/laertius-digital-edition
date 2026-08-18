/**
 * Work ontology: a curated facet layer over every lo:Work node in the graph
 * (claim-derived works + source-works). Four facets per work, plus dating:
 *
 *   - form:  prose | verse | mixed (prosimetrum). Explicit for every work;
 *     null is a curated statement of ignorance, never a default.
 *   - topic: a closed union of 24 topics. Philosophical topics follow
 *     Diogenes Laertius' OWN tripartition of philosophy (D.L. 1.18: physics,
 *     ethics, dialectic), plus politics as practical philosophy. Everything
 *     else (rhetoric, grammar, poetics, the exact sciences, poetry genres,
 *     historiography, letters...) is non-philosophical BY THE ANCIENT
 *     DIVISION - deliberately so: Aristotle's Poetics classifies as poetics
 *     and hence non-philosophical here, which is D.L.'s conception, not the
 *     modern one. The per-work `philosophical` override exists for the rare
 *     cases where the topic-derived flag would misstate the work's nature
 *     (e.g. actual legislation vs political philosophy).
 *   - philosophical: DERIVED from the topic via TOPIC_PHILOSOPHICAL, never
 *     curated per work (no contradictions possible), except for the explicit
 *     per-work override above.
 *   - survival: lost (default, absent) | excerpts | extant. "excerpts" is
 *     asserted ONLY where verbatim quotations attributed to THE WORK itself
 *     survive (D.L.'s own quotes count); testimonia, paraphrase and
 *     fragments not attributable to a specific catalogue title leave a work
 *     lost (hence every Democritus title is lost despite the surviving
 *     ethical fragments). "extant" records transmission, not authenticity
 *     (the Platonic spuria, Mechanics, The Tablet are extant). Explicit
 *     null = conflated homonym node with DIVERGENT transmission (Symposium,
 *     Republic, Of the End, Alcibiades, On Nature, On the Gods, the merged
 *     Theophrastus botany node). Identifications with surviving treatises
 *     are made only where standard (never guess a homonym: Aristotle's
 *     "Politics (two books)" vs the extant eight books stays lost).
 *
 * Dating (century / decade of production):
 *   - lo:compositionCentury is a negative integer for BCE centuries under the
 *     strict convention (Nth c. BCE = 100N..100(N-1)+1 BCE; 400 BCE is 4th
 *     century, 401 BCE is 5th). Derived per work from its authors: every
 *     author must resolve to a single production century (curated
 *     AUTHOR_PRODUCTION_CENTURY first, else the kg-ontology chronology bounds
 *     when both fall in one century - a lifespan inside one century implies
 *     production in that century), and all authors must agree. Conflated
 *     homonym nodes with disagreeing or unresolvable authors (e.g. "On
 *     Education" = Aristippus + the pseudo-Pythagorean tract) get NO century.
 *   - lo:compositionDecade (decade start year, negative for BCE: -590 = the
 *     590s BCE) exists ONLY where a production decade is genuinely attested;
 *     currently a single entry (Solon's laws, archonship of 594/3, D.L.
 *     1.62). Modeled-but-sparse, like lo:lost - never guess a decade.
 *
 * Judgment calls (documented, deliberate):
 *   - Metaphysical/ontological titles (On the Idea, On Being, On the Unit,
 *     Parmenides...) classify under dialectic, matching D.L.'s own labelling
 *     of the Sophist and Parmenides as "logical" (3.58).
 *   - Theology (Of the Gods, theogonies aside) classifies under physics, the
 *     ancient placement; psychology likewise (Aristotle's Of the Soul), but
 *     Socratic soul-dialogues stay ethics (D.L. calls the Phaedo ethical).
 *   - Political PHILOSOPHY (Republics, Of Kingship, On Legislation) is
 *     politics with philosophical=true; actual statutes and policy pamphlets
 *     (Solon's laws, Xenophon's On Revenues, the Constitutions collections,
 *     Aristotle's Claims advanced) carry philosophical:false overrides.
 *   - Stoic work on language and logic (solecisms, singular/plural
 *     expressions) is dialectic - the Stoics' own classification; philological
 *     work on texts (glosses, diction, metres) is grammar; literary criticism
 *     and Homeric problems are poetics.
 *   - lyric covers all shorter verse (elegiac, gnomic, didactic, hymns);
 *     epic covers hexameter narrative (Epimenides' poems, Xenophanes'
 *     foundation poems, the Xerxes invasion poem).
 *   - The Seven Sages' poems (Lobon-derived attributions of dubious
 *     authenticity) get form/topic facets but NO production century - except
 *     Solon, whose poems and laws are genuine. Pythagoras, Epimenides, Cebes
 *     and Epicharmus works are likely pseudepigrapha: facets yes, dating no.
 *   - "Works by him survive of great beauty and excellence" (Heraclides) is
 *     a catalogue remark, not a title: form/topic both null.
 *
 * The label is the join key with the lo:Work node - never touch labels here;
 * lod.ts throws on any label missing from WORK_FACETS and on stale keys.
 */

import type { WorkFacet } from "./work-ontology/types";
import { SAGES_PRESOCRATICS_WORKS } from "./work-ontology/sages-presocratics";
import { SOCRATICS_WORKS } from "./work-ontology/socratics";
import { PLATO_ACADEMY_WORKS } from "./work-ontology/plato-academy";
import { ARISTOTLE_WORKS } from "./work-ontology/aristotle";
import { THEOPHRASTUS_WORKS } from "./work-ontology/theophrastus";
import { PERIPATOS_WORKS } from "./work-ontology/peripatos";
import { STOA_WORKS } from "./work-ontology/stoa";
import { CYNICS_EPICUREANS_WORKS } from "./work-ontology/cynics-epicureans";
import { MISC_WORKS } from "./work-ontology/misc";

export type {
  WorkFacet,
  WorkForm,
  WorkSurvival,
  WorkTopic,
} from "./work-ontology/types";
import type { WorkForm, WorkSurvival, WorkTopic } from "./work-ontology/types";

/** Turtle-name of the lo:WorkForm individual for each form. */
export const WORK_FORM_INDIVIDUAL: Record<WorkForm, string> = {
  prose: "ProseForm",
  verse: "VerseForm",
  mixed: "MixedForm",
};

export const WORK_FORM_LABEL: Record<WorkForm, string> = {
  prose: "prose",
  verse: "verse",
  mixed: "prosimetrum (mixed prose and verse)",
};

/**
 * Turtle-name of the lo:SurvivalStatus individual for each survival value.
 * "lost" is the default when a facet omits `survival` (see types.ts): in
 * D.L.'s catalogues the overwhelming majority of works survive as titles
 * only, so lost is the unmarked case and extant/excerpts are curated
 * exceptions.
 */
export const WORK_SURVIVAL_INDIVIDUAL: Record<WorkSurvival, string> = {
  lost: "LostStatus",
  excerpts: "ExcerptsStatus",
  extant: "ExtantStatus",
};

export const WORK_SURVIVAL_LABEL: Record<WorkSurvival, string> = {
  lost: "lost (only the title survives)",
  excerpts: "surviving in excerpts and quoted fragments",
  extant: "extant (preserved entire or substantially so)",
};

/** Turtle-name of the lo:WorkTopic individual for each topic. */
export const WORK_TOPIC_INDIVIDUAL: Record<WorkTopic, string> = {
  physics: "PhysicsTopic",
  ethics: "EthicsTopic",
  dialectic: "DialecticTopic",
  politics: "PoliticsTopic",
  rhetoric: "RhetoricTopic",
  grammar: "GrammarTopic",
  poetics: "PoeticsTopic",
  mathematics: "MathematicsTopic",
  astronomy: "AstronomyTopic",
  geography: "GeographyTopic",
  medicine: "MedicineTopic",
  music: "MusicTopic",
  technical: "TechnicalTopic",
  history: "HistoryTopic",
  biography: "BiographyTopic",
  chronology: "ChronologyTopic",
  doxography: "DoxographyTopic",
  epic: "EpicTopic",
  lyric: "LyricTopic",
  tragedy: "TragedyTopic",
  comedy: "ComedyTopic",
  satire: "SatireTopic",
  letters: "LettersTopic",
  miscellany: "MiscellanyTopic",
};

export const WORK_TOPIC_LABEL: Record<WorkTopic, string> = {
  physics: "physics (natural philosophy, incl. psychology, zoology, botany, theology)",
  ethics: "ethics (incl. Socratic dialogues and practical philosophy)",
  dialectic: "dialectic (logic, epistemology, metaphysics, philosophy of language)",
  politics: "politics (political philosophy and legislation)",
  rhetoric: "rhetoric",
  grammar: "grammar (philology: glosses, diction, metres, proverbs)",
  poetics: "poetics (literary criticism, Homeric problems, on poets)",
  mathematics: "mathematics (incl. geometry, optics, mechanics)",
  astronomy: "astronomy (incl. calendars)",
  geography: "geography",
  medicine: "medicine (incl. dietetics and pathology)",
  music: "music",
  technical: "technical arts (husbandry, tactics, machines, painting)",
  history: "history (incl. constitutions described, discoveries)",
  biography: "biography (lives, memoirs, encomia of persons)",
  chronology: "chronology (chronicles, victor lists, records)",
  doxography: "doxography (opinions, epitomes and expositions of other philosophers)",
  epic: "epic poetry (hexameter narrative and didactic epos)",
  lyric: "lyric poetry (elegiac, gnomic, hymns and other shorter verse)",
  tragedy: "tragedy",
  comedy: "comedy",
  satire: "satire (incl. silloi and Menippean satire)",
  letters: "letters (epistolary works)",
  miscellany: "miscellany (notes, anecdotes, fables, mixed collections)",
};

/**
 * Which topics count as philosophical: exactly D.L.'s tripartition (1.18)
 * plus politics as practical philosophy. Everything else is non-philosophical
 * by the ancient division (see module header).
 */
export const TOPIC_PHILOSOPHICAL: Record<WorkTopic, boolean> = {
  physics: true,
  ethics: true,
  dialectic: true,
  politics: true,
  rhetoric: false,
  grammar: false,
  poetics: false,
  mathematics: false,
  astronomy: false,
  geography: false,
  medicine: false,
  music: false,
  technical: false,
  history: false,
  biography: false,
  chronology: false,
  doxography: false,
  epic: false,
  lyric: false,
  tragedy: false,
  comedy: false,
  satire: false,
  letters: false,
  miscellany: false,
};

/**
 * Curated production century per author label (claim subjects and
 * source-works sources), for authors whose entire literary production sits in
 * one century even when their lifespan straddles two (Plato: everything
 * post-399; Xenophon: everything post-401; Aristotle 384-322). Authors whose
 * production genuinely straddles centuries (Theophrastus, Epicurus, Zeno,
 * Demetrius of Phalerum, Stilpo, Crates, Crantor, Democritus, Xenophanes) are
 * deliberately absent - their works carry no century. Authors whose corpus is
 * pseudepigraphic (Pythagoras, Epimenides, Cebes, Epicharmus, the non-Solon
 * sages) are absent for the opposite reason: the attributed author's date
 * would misdate the actual production.
 */
export const AUTHOR_PRODUCTION_CENTURY: Record<string, number> = {
  Plato: -4,
  Xenophon: -4,
  Aristotle: -4,
  Aristippus: -4,
  Speusippus: -4,
  Xenocrates: -4,
  "Heraclides Ponticus": -4,
  "Diogenes of Sinope": -4,
  Monimus: -4,
  Aeschines: -4,
  Phaedo: -4,
  Euclides: -4,
  Cleanthes: -3,
  Chrysippus: -3,
  Sphaerus: -3,
  Herillus: -3,
  "Dionysius the Renegade": -3,
  Timon: -3,
  Menippus: -3,
  Hermippus: -3,
  Apollodorus: -2,
  Simon: -5,
  Protagoras: -5,
  Empedocles: -5,
  Philolaus: -5,
  Heraclitus: -5,
  Achaeus: -5,
  Pherecydes: -6,
  Solon: -6,
};

/**
 * Per-work century overrides, for works datable independently of their
 * author's overall production. Zeno's Republic was written while he was still
 * a pupil of Crates (D.L. 7.4), i.e. in the late 4th century, though the rest
 * of his production is 3rd-century (and he therefore has no author entry).
 */
export const WORK_CENTURY_OVERRIDES: Record<string, number> = {
  "Republic (Politeia)": -4,
};

/**
 * Production decades (decade start year; -590 = the 590s BCE), ONLY where
 * genuinely attested. Solon's laws are dated by his archonship (594/3 BCE,
 * D.L. 1.62: archon in the third year of the 46th Olympiad).
 */
export const WORK_DECADES: Record<string, { decade: number; ref: string }> = {
  "Laws (the laws which bear his name)": { decade: -590, ref: "1.62" },
};

/**
 * Century of a (possibly negative, astronomical-free) calendar year under the
 * strict convention: 400 BCE (-400) is the 4th c. BCE (-4), 401 BCE the 5th;
 * 100 CE is the 1st century CE (1).
 */
export function centuryOfYear(year: number): number {
  return year < 0 ? Math.floor(year / 100) : Math.ceil(year / 100);
}

function mergeFacets(
  ...tables: Record<string, WorkFacet>[]
): Record<string, WorkFacet> {
  const out: Record<string, WorkFacet> = {};
  for (const table of tables) {
    for (const [label, facet] of Object.entries(table)) {
      if (label in out) {
        throw new Error(
          `work-ontology: duplicate work label "${label}" across chunk files - shared titles must be curated exactly once`,
        );
      }
      out[label] = facet;
    }
  }
  return out;
}

/** Every lo:Work label in the graph, exactly once. lod.ts enforces coverage. */
export const WORK_FACETS: Record<string, WorkFacet> = mergeFacets(
  SAGES_PRESOCRATICS_WORKS,
  SOCRATICS_WORKS,
  PLATO_ACADEMY_WORKS,
  ARISTOTLE_WORKS,
  THEOPHRASTUS_WORKS,
  PERIPATOS_WORKS,
  STOA_WORKS,
  CYNICS_EPICUREANS_WORKS,
  MISC_WORKS,
);
