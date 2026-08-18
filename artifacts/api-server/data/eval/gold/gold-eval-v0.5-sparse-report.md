# Gold v0.5 evaluation report (laertius-sparse)

- Generated: 2026-08-07T11:24:48.117Z
- Topic set: topics-msirqauf-a963a7 (Gold v0.5 (200 questions, 140/30/30))
- Snapshot: snap-msirqatw-0f1d0a
- Run: run-msiuy53y-f14eff (system `laertius-sparse`, top 10, modes: sparse)
- Qrels: gold-qrels-v0.5.jsonl (239 rows)

## Answerable topics

| metric | value |
| --- | --- |
| topics | 175 (scored: 150) |
| MRR | 0.3193 |
| recall@10 | 48.4% |
| nDCG@10 | 0.3542 |
| hit@10 | 51.3% |

## Abstention topics — per subtype (never merged)

| subtype | topics | with gold evidence | evidence hit@10 |
| --- | --- | --- | --- |
| out_of_corpus | 10 | 0 | 0 |
| false_premise | 8 | 8 | 0 |
| underspecified_homonym | 7 | 5 | 0 |

Retrieval-only runs cannot abstain; for abstention subtypes this reports
whether the gold evidence passages (where they exist — false-premise
contradicting passages, homonym-roster passages) were surfaced in the top 10.
