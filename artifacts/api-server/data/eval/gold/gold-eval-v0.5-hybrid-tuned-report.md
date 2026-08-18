# Gold v0.5 evaluation report (laertius-hybrid-tuned)

- Generated: 2026-08-07T13:56:44.898Z
- Topic set: topics-msirqauf-a963a7 (Gold v0.5 (200 questions, 140/30/30))
- Snapshot: snap-msirqatw-0f1d0a
- Run: run-msiyunhu-5bb68b (system `laertius-hybrid-tuned`, top 10, modes: hybrid)
- Qrels: gold-qrels-v0.5.jsonl (239 rows)

## Answerable topics

| metric | value |
| --- | --- |
| topics | 150 (scored: 150) |
| excluded (dataset_aggregate) | 25 |
| MRR | 0.5061 |
| recall@10 | 81.8% |
| nDCG@10 | 0.5783 |
| hit@10 | 84.0% |

Topics excluded with reason `dataset_aggregate` are answerable corpus-
statistics / synthesis questions whose gold answers are computed from the
dataset as a whole; no single CTS passage attests them, so they carry a
documented `no_gold_passage_reason` in the qrels instead of gold passages
and sit outside the passage-retrieval metric denominators.

## Abstention topics — per subtype (never merged)

| subtype | topics | with gold evidence | evidence hit@10 |
| --- | --- | --- | --- |
| out_of_corpus | 10 | 0 | 0 |
| false_premise | 8 | 8 | 5 |
| underspecified_homonym | 7 | 5 | 2 |

Retrieval-only runs cannot abstain; for abstention subtypes this reports
whether the gold evidence passages (where they exist — false-premise
contradicting passages, homonym-roster passages) were surfaced in the top 10.
