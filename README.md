# Laertius Digital Scholarly Edition

[Laertius](https://laertius.humanisticadigitalia.eu/) is a digital
scholarly edition of Diogenes Laertius' *Lives of Eminent Philosophers*. It
combines the Greek text and the public-domain R. D. Hicks translation with
curated scholarly assertions, linked open data, knowledge-graph exploration,
SPARQL access, and hybrid passage retrieval.

## Repository structure

- `artifacts/laertius` — React/Vite public interface.
- `artifacts/api-server` — main Express API, LOD/SPARQL services, retrieval,
  and optional generative answer synthesis.
- `artifacts/legomena-api` — Legomena RDF and retrieval API.
- `artifacts/eval` — protected evaluation interface.
- `lib` — shared API, validation, database, and React client libraries.
- `scripts` — ingestion, validation, build, evaluation, and deployment tools.
- `docs` — architecture, evaluation, and TEI-pipeline documentation.

## Requirements

- Node.js 20.9 or newer
- [pnpm](https://pnpm.io/) 10 or newer

## Install and build

```bash
corepack enable
pnpm install
pnpm run typecheck
pnpm run build
```

The public interface is built from `artifacts/laertius`. The main API is in
`artifacts/api-server`, and the Legomena service is in
`artifacts/legomena-api`.

## Configuration and secrets

Copy `.env.example` to a local `.env` file only when runtime configuration is
needed. Never commit an API key, password, evaluation token, private key, or
production environment file. Local environment files and live evaluation
state are excluded by `.gitignore`.

Generative answer synthesis is optional. When configured, the server sends
the user's question and selected evidence passages to the configured
OpenAI-compatible API. If it is not configured or is unavailable, the Ask
service falls back to an extractive answer.

The most relevant runtime variables are documented in `.env.example`:

- `LAERTIUS_DATA_DIR`
- `SERVE_STATIC_DIR`
- `LOD_BASE_URI`
- `LEGOMENA_MODEL_CACHE`
- `RATE_LIMIT_RAG_MAX`
- `LAERTIUS_LLM_BASE_URL`
- `LAERTIUS_LLM_API_KEY`
- `LAERTIUS_LLM_MODEL`
- `EVAL_ACCESS_PASSWORD`
- `EVAL_COORDINATOR_PASSWORD`

## Documentation

- [Architecture](docs/architecture.md)
- [Evaluation](docs/evaluation.md)
- [TEI pipeline](docs/tei-pipeline.md)

## Licensing

This repository uses separate terms for software and scholarly content:

- Software source code: Apache License 2.0 — see [LICENSE](LICENSE).
- Curated scholarly data and documentation: CC BY-NC-SA 4.0 — see
  [LICENSE-DATA](LICENSE-DATA).
- The ancient Greek text and R. D. Hicks' English translation are identified
  in the license notices as public-domain material.

Copyright © 2026 Maria Papadopoulou — Humanistica Digitalia / Philographia.

