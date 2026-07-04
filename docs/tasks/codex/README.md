# Таски для Codex — финальная добивка решения

Порядок: **A → B → C → D**. A и C независимы (можно параллельно в разных сессиях),
B требует A и `OPENAI_API_KEY`, D — всегда последним.

Уже сделано (закоммичено в `59a2a7d`, не переделывать):
- compose: сайдкар по умолчанию в mock-режиме (без `.env` стек работает без ключей);
  live включается только через `agent-system/.env` (см. `.env.example`).
- backend: `HttpExtractSource` снова с fallback на фикстуру (LLM недоступна → `/run`
  не падает); корпус live-извлечения читается из `docs/extract_corpus.json`, а не
  из хардкода двух txt.
- `board.json` (обе копии): `source_file` снова repo-relative.
- Приватные материалы (транскрипции QA, дамп чата, norn-dop-data) убраны из индекса.

Общие правила для каждого таска:
- Прочитать: `docs/AGENTS.md` (закон границы волатильности), `docs/CONTRACTS.md`.
- Тесты и линтеры зелёные перед коммитом: `cd agent-system && ruff check app tests &&
  python3 -m pytest -q tests` · `cd backend && cargo clippy --workspace -- -D warnings
  && cargo test --workspace` · `cd frontend && pnpm lint && NODE_OPTIONS=--no-experimental-webstorage pnpm test`.
- Коммитить по завершении таска одним коммитом, НЕ пушить.
- Не трогать: crates/engine (кроме UPDATE_GOLDEN-перегенерации в B), детерминизм
  /run, существующие эндпоинты и контракты без явного указания в таске.
