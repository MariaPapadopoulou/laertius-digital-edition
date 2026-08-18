# Laertius — Retrieval Evaluation: Methodology, Status, and Limitations

Source of truth for how the Gold v0.5 retrieval evaluation was built, what
the numbers mean, and — just as important — what they do not claim. Read
alongside `artifacts/api-server/data/eval/gold/gold-eval-v0.5-comparison.md`
(the aggregate comparison) and `gold-eval-v0.5-significance.md` (paired
significance tests).

## Dataset

- Topic set: Gold v0.5, 200 questions — 175 answerable, 25 abstention
  (10 out-of-corpus, 8 false-premise, 7 underspecified-homonym).
- Qrels: `gold-qrels-v0.5.jsonl`, graded relevance resolved against a pinned
  corpus snapshot; produced from the curator's workbook via
  `scripts/src/ingest-gold-workbook.ts` and validated by
  `validate-gold-workbook`.
- **Dataset-aggregate topics**: 25 of the 175 answerable questions ask about
  corpus-level aggregates (counts, distributions) that no single passage can
  answer. They carry an explicit `no_gold_passage_reason` in the qrels and
  are excluded from all passage-metric denominators (answerable scored
  n=150). This is a documented design decision, enforced in
  `goldScoring.ts` and pinned by `validate-gold-abstain` — not silent
  attrition. Consequence: the passage metrics describe passage-answerable
  questions only; aggregate questions are served by the stats-answer layer,
  which has its own validator (`validate-stats-answers`) but no
  retrieval-style metric.

## Metrics and significance

- Metrics: MRR, recall@10, nDCG@10, hit@10 over the 150 scored answerable
  topics; abstention subtypes are reported separately and never merged.
- **Paired significance testing** (`scripts/src/gold-significance.ts`,
  output `gold-eval-v0.5-significance.md`): paired two-sided sign-flip
  randomization test (20 000 resamples) plus paired bootstrap 95% CI
  (10 000 resamples) on per-topic MRR, recall@10 and hit@10 for every system
  pair, with a positive control proving the tested population reproduces the
  scorer's aggregates. Headline results: both hybrids beat sparse decisively
  (p < 0.0001 on all metrics); the ORIGINAL equal-weight hybrid is NOT
  significantly better than dense alone (p ≥ 0.27 on every metric); the
  tuned hybrid is significantly better than dense (p ≤ 0.0003) and better
  than the original hybrid on MRR/recall@10 at the conventional 0.05 level
  (p = 0.0077 / 0.0014), though the hit@10 improvement (p = 0.0285) does not
  survive a Bonferroni correction across the 15 comparisons.
- nDCG@10 is descriptive only: the persisted per-topic primitives do not
  retain graded rankings, so it is not significance-tested.
- Caveat: the tuned fusion parameters were selected on this same topic set
  (55-variant sweep, `gold-eval-v0.5-fusion-tuning.md`). The tuned-vs-others
  comparisons therefore carry selection optimism; confirming them requires a
  held-out topic set.

## Human judging status (pools and batches)

- A depth-5 judging pool (2 judgments per item) and four 50-item judge
  batches exist under `artifacts/api-server/data/eval/pools/` and
  `batches/`: each annotator holds their original 50 items plus a crossover
  batch containing the other annotator's 50, so 100 items are assigned for
  double judging and inter-annotator agreement. The eval workbench supports
  uploading judgment JSONL, agreement metrics, and adjudication.
- **No completed judgment or adjudication files are included yet.** The
  reported metrics rest entirely on the curator-authored gold qrels, not on
  independent double judging. Inter-annotator agreement and adjudicated
  relevance are future work; until then the qrels reflect a single expert's
  relevance decisions (with the workbook validation below as the audit
  trail).
- **Blinding**: to keep the expert judging independent, the gold qrels
  (`gold-qrels-*.jsonl`) are withheld from the public source archive until
  double judging and adjudication complete; judges must not be able to
  consult the curator's prior relevance decisions. The qrels remain in the
  repository and in the deployment bundle (the workbench itself is
  password-gated).

## Workbook validation

- `gold-workbook-v0.5-validation-report.md` records the deterministic
  cross-check between the workbook and the ingested qrels/topics. It lists
  **9 known discrepancies**, each annotated `[known]` with its resolution
  (1 false-premise topic, 4 quotation discrepancies, 4 teacher-student
  discrepancies). They are retained deliberately as a
  transparent audit trail; `validate-gold-workbook` fails on any NEW
  discrepancy beyond the documented nine.

## Generative RAG: what is and is not evaluated

- The retrieval metrics above evaluate the RANKERS only. The optional
  generative answer layer (`generate-answer.ts`) is NOT covered by them: no
  answer-quality, faithfulness or end-to-end metric is reported.
- What IS enforced (by `validate-ask-generative` and unit-level checks):
  strict-grounding prompt; the context is built from the retrieved passages
  plus curated claim/verse/saying hits; `sanitizeCitations` strips any
  citation whose id was not in the supplied context; on missing
  configuration or any LLM failure the system falls back to the extractive
  summary.
- **Citation-check limitation**: the citation guard verifies that every
  cited section was present in the model's context — it does NOT verify
  that each generated sentence is actually entailed by the cited passage.
  A model can cite a real, in-context section while paraphrasing it
  inaccurately. Sentence-level support verification (e.g. NLI-based
  entailment scoring or human faithfulness judging over a sample of
  generated answers) is explicitly future work; until then generative
  answers should be read as "cites only real retrieved passages", not
  "every claim verified against its citation".

## Summary of open gaps

1. Held-out topic set to confirm the tuned-fusion gains without selection
   optimism.
2. Completed double judging + adjudication over the existing pool/batches;
   report inter-annotator agreement.
3. Faithfulness evaluation of the generative layer (sentence-level support,
   not just citation-id validity).
4. Aggregate (dataset-level) questions have correctness validation but no
   graded metric comparable to the passage metrics.
