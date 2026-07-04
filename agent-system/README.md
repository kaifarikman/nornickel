# Nornikel Agent System

Python sidecar for extraction, deterministic diagnostics, pgvector RAG, novelty,
skeptic review, narration, and per-step run artifacts.

## Run

Для демо надёжнее локальный uvicorn — стартует на чистой машине без `.env`,
без сети и без Postgres (`/health`, `/diagnose`, mock-`/extract` работают из коробки):

```bash
pip install .
uvicorn app.api.main:app --port 8765
```

Docker — дополнительный вариант (Postgres/pgvector для RAG-пути):

```bash
cp .env.example .env
# для live-режима заполнить YANDEX_API_KEY, YANDEX_FOLDER_ID, YANDEX_MODEL_EXTRACT, YANDEX_MODEL_FAST
docker compose up --build
```

API: `http://localhost:8765`

## Checks

```bash
python -m compileall app
python -m pytest -p no:rerunfailures tests/test_extract_contracts.py tests/test_retrieval_contracts.py
```

## Runtime Data

`resources/` contains the minimal fixtures, pack, and sample documents needed
when this repository is cloned without the sibling `docs` repository. If `../docs`
exists, the service uses it automatically.
