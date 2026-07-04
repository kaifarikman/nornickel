# Nornikel Agent System — Agent Sidecar

Python-сайдкар: извлечение фактов, детерминированная диагностика, pgvector-RAG,
novelty, skeptic-review, нарратив и пошаговые артефакты прогонов. Волатильная
часть системы (LLM, парсинг, эмбеддинги, оркестрация pipeline) по границе
волатильности из [../docs/AGENTS.md](../docs/AGENTS.md) — при смене задачи
переписывается только этот сайдкар и pack, ядро не трогается.

## Стек

- Python 3.12
- FastAPI + uvicorn
- pydantic 2 / pydantic-settings
- openai-совместимый клиент (Yandex), pymupdf, python-docx, openpyxl
- psycopg + pgvector (RAG-путь, опционально)
- ruff + mypy + pytest

## Быстрый старт

Для демо надёжнее локальный uvicorn — стартует на чистой машине без `.env`,
без сети и без Postgres (`/health`, `/diagnose`, mock-`/extract` работают из коробки):

```bash
pip install .
uvicorn app.api.main:app --port 8765   # http://localhost:8765
```

Docker — дополнительный вариант (Postgres/pgvector для RAG-пути):

```bash
cp .env.example .env
# для live-режима заполнить OPENAI_API_KEY
# по умолчанию: LLM_PROVIDER=openai, GPT model=gpt-5.5, embeddings=text-embedding-3-small
docker compose up --build
```

## Проверки

```bash
pip install .[dev]
ruff check app tests    # линт (E501 отключён в pyproject)
mypy app                # типы
python -m compileall app
python -m pytest        # контракт-тесты extract/retrieval, документы, path-security
```

## Данные

`resources/` содержит минимальные фикстуры, pack и sample-документы, нужные при
клонировании этого репозитория без соседнего `docs`. Если `../docs` существует,
сервис использует его автоматически.
