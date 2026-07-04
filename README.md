# Nornickel Hypothesis Factory

Monorepo for the hackathon solution:

- `frontend/` — React/Vite UI, served by nginx in Docker.
- `backend/` — Rust platform + deterministic discovery engine.
- `agent-system/` — Python FastAPI sidecar for diagnostics/extraction/constraints.
- `docs/` — contracts, fixtures, packs, factories, demo docs.
- `norn-hack/Пример 1..4/` — small xlsx/docx case inputs required for `/diagnose`.

## Run

```bash
docker compose up --build
```

Then open:

- frontend: <http://localhost>
- backend API: <http://localhost:8080>
- sidecar API: <http://localhost:8765>

The default compose stack runs without `.env`, external LLM credentials, or Postgres.
RAG/Postgres remains optional via the `rag` profile in `compose.yaml`.

## Smoke Checks

```bash
curl -sS -XPOST http://localhost:8080/run \
  -H 'content-type: application/json' \
  -d '{"factory_id":"kgmk","pack_id":"flotation-v1"}'

curl -sS -XPOST http://localhost:8080/run \
  -H 'content-type: application/json' \
  -d '{"factory_id":"hidden_nof_med","pack_id":"flotation-v1","source_file":"norn-hack/Пример 3/Хвосты НОФ мед.xlsx"}'
```

Large PDFs and extra local data are intentionally ignored. The committed fixtures
and the small Excel/Word case files are enough for the demo path.
