# Gold v0.5 evaluation report (laertius-dense)

- Generated: 2026-08-07T11:24:57.248Z
- Topic set: topics-msirqauf-a963a7 (Gold v0.5 (200 questions, 140/30/30))
- Snapshot: snap-msirqatw-0f1d0a
- Run: run-msiuyc5q-7e337b (system `laertius-dense`, top 10, modes: dense)
- Qrels: gold-qrels-v0.5.jsonl (239 rows)

## Answerable topics

| metric | value |
| --- | --- |
| topics | 175 (scored: 150) |
| MRR | 0.4253 |
| recall@10 | 69.4% |
| nDCG@10 | 0.4846 |
| hit@10 | 72.0% |

## Abstention topics — per subtype (never merged)

| subtype | topics | with gold evidence | evidence hit@10 |
| --- | --- | --- | --- |
| out_of_corpus | 10 | 0 | 0 |
| false_premise | 8 | 8 | 5 |
| underspecified_homonym | 7 | 5 | 2 |

Retrieval-only runs cannot abstain; for abstention subtypes this reports
whether the gold evidence passages (where they exist — false-premise
contradicting passages, homonym-roster passages) were surfaced in the top 10.
