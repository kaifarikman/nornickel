# Nornickel Hypothesis Factory

Монорепо решения хакатона. R&D Decision Platform: из локального корпуса
(PDF/DOCX/CSV) строит объяснимый, воспроизводимый, ранжированный портфель
проверяемых гипотез с трассировкой до источников. Источник правды по правилам —
[docs/AGENTS.md](docs/AGENTS.md).

## Состав

- `frontend/` — React/Vite UI, за nginx в Docker. См. [frontend/README.md](frontend/README.md).
- `backend/` — Rust-платформа + детерминированный discovery-движок. См. [backend/README.md](backend/README.md).
- `agent-system/` — Python FastAPI-сайдкар: диагностика, извлечение, constraints. См. [agent-system/README.md](agent-system/README.md).
- `docs/` — контракты, фикстуры, packs, factories, демо-документы.
- `norn-hack/Пример 1..4/` — небольшие xlsx/docx кейс-файлы для `/diagnose`.

## Запуск

```bash
docker compose up --build
```

Затем открыть:

- frontend: <http://localhost>
- backend API: <http://localhost:8080>
- sidecar API: <http://localhost:8765>

Стек по умолчанию поднимается без `.env`, внешних LLM-ключей и Postgres.
RAG/Postgres — опция через профиль `rag` в `compose.yaml`.

## Проверки

Smoke-проверка API (полный сценарий и скрытая фабрика по файлу):

```bash
curl -sS -XPOST http://localhost:8080/run \
  -H 'content-type: application/json' \
  -d '{"factory_id":"kgmk","pack_id":"flotation-v1"}'

curl -sS -XPOST http://localhost:8080/run \
  -H 'content-type: application/json' \
  -d '{"factory_id":"hidden_nof_med","pack_id":"flotation-v1","source_file":"norn-hack/Пример 3/Хвосты НОФ мед.xlsx"}'
```

Большие PDF и лишние локальные данные намеренно игнорируются: закоммиченных
фикстур и малых Excel/Word-файлов достаточно для демо-пути.

## CI

GitHub Actions (`.github/workflows/`), по сервису со своим path-фильтром:

- **Frontend** — lint, typecheck, test (coverage), build, docker + smoke.
- **Backend** — `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, docker.
- **Agent System** — `ruff`, `mypy`, `compileall`, `pytest`, docker.
- **Security** — `pnpm audit`, CodeQL (SAST), gitleaks; плюс запуск по расписанию.

Dependabot обновляет npm/cargo/pip-зависимости и GitHub Actions еженедельно.
