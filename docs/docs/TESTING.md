# TESTING.md

## Запуск
- Rust: `cargo test --workspace`
- Python: `pytest sidecar/tests`
- Web: `pnpm -C web test`
- Всё: `just test`

## Структура
- `crates/engine/tests/` — unit на операторы и scoring (без сети).
- `crates/engine/tests/golden/` — golden-файлы: фикс-граф → фикс-портфель.
  **Детерминизм:** тот же snapshot+hash обязан давать тот же выход. Падение golden = регресс.
- `crates/platform/tests/` — API-контракт, валидация входного JSON, sqlite.
- `sidecar/tests/` — схема извлечения (LLM замокан), парсеры.
- `web/` — компоненты против `fixtures/`.

## Правило
Любой PR в engine добавляет/обновляет golden-тест. Контракт меняется → обновляются фикстуры.
