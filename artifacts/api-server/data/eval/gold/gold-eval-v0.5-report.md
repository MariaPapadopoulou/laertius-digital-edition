# Gold v0.5 evaluation report

- Generated: 2026-08-07T11:36:21.118Z
- Topic set: topics-msirqauf-a963a7 (Gold v0.5 (200 questions, 140/30/30))
- Snapshot: snap-msirqatw-0f1d0a
- Run: run-msirqepm-178b32 (system `laertius-hybrid`, top 10, modes: hybrid)
- Qrels: gold-qrels-v0.5.jsonl (239 rows)

## Answerable topics

| metric | value |
| --- | --- |
| topics | 150 (scored: 150) |
| excluded (dataset_aggregate) | 25 |
| MRR | 0.4592 |
| recall@10 | 71.4% |
| nDCG@10 | 0.5165 |
| hit@10 | 76.0% |

Topics excluded with reason `dataset_aggregate` are answerable corpus-
statistics / synthesis questions whose gold answers are computed from the
dataset as a whole; no single CTS passage attests them, so they carry a
documented `no_gold_passage_reason` in the qrels instead of gold passages
and sit outside the passage-retrieval metric denominators.

## Abstention topics — per subtype (never merged)

| subtype | topics | with gold evidence | evidence hit@10 |
| --- | --- | --- | --- |
| out_of_corpus | 10 | 0 | 0 |
| false_premise | 8 | 8 | 4 |
| underspecified_homonym | 7 | 5 | 0 |

Retrieval-only runs cannot abstain; for abstention subtypes this reports
whether the gold evidence passages (where they exist — false-premise
contradicting passages, homonym-roster passages) were surfaced in the top 10.
