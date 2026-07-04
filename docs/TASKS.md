# TASKS.md — независимая разработка на 4 человека

> ⚠️ **УСТАРЕЛО НА ФИНАЛЬНЫЙ СПРИНТ.** Актуальные задачи под реальные данные кейса
> (флотация, хвосты) — в **`FINAL_SPRINT.md`**. Этот файл — историческая справка.

## Файлы задач по ролям
- `rust_tasks.md` — Роль 1: Rust Track.
- `python_tasks.md` — Роль 2: Python Agent.
- `frontend_tasks.md` — Роль 3: Frontend.
- `demo_data_qa_tasks.md` — Роль 4: Demo/Data/QA.

## Готовые prompt-файлы для агентов
- `prompt_rust.md` — отдать Rust-разработчику.
- `prompt_python.md` — отдать Python/Agent-разработчику.
- `prompt_frontend.md` — отдать Frontend-разработчику.
- `prompt_demo_qa.md` — отдать Demo/Data/QA участнику.

## Agent-specific prompts
- `agents/codex/*.md` — использовать, если участник работает через Codex.
- `agents/claude/*.md` — использовать, если участник работает через Claude Code.
- `user_*.md` — универсальные prompts, если агент заранее неизвестен.

## Час 0: общий контракт
Перед параллельной работой команда вместе фиксирует:
- `CONTRACTS.md`;
- `fixtures/extract_response.json`;
- `fixtures/board.json`;
- `packs/alloys-v1.yaml`;
- demo KPI из `DEMO_SCENARIO.md`.

После этого каждый трек работает независимо против fixtures.

## Роль 1 — Rust Track: contracts + engine + API
Один разработчик владеет всем Rust-контуром.

Сделать:
- создать `crates/contracts` с типами из `CONTRACTS.md`;
- создать `crates/engine` с `discover(graph, contract, pack)`;
- реализовать operators MVP: `mechanism_path`, `substitution`, `gap`;
- реализовать weighted scoring и hard constraints;
- создать `crates/platform` с Axum API;
- поддержать `GET /board`, `GET /hypothesis/:id`, `POST /run`, `POST /rerun`;
- API сначала может отдавать fixtures, затем подключает engine.

Done:
- фиксированный graph + KPI + pack даёт стабильный board;
- rerun меняет порядок или статус гипотез;
- engine не содержит доменной семантики.

## Роль 2 — Python Agent
Сделать:
- FastAPI service с `POST /extract`;
- Pydantic-модели под `ExtractResponse`;
- mock extraction, возвращающий `fixtures/extract_response.json`;
- parser для `.txt` и простой extractor из `sample_docs/`;
- optional LLM extraction за feature flag/env.

Done:
- `POST /extract` возвращает валидный JSON;
- невалидный документ даёт понятную ошибку;
- агент не ранжирует гипотезы.

## Роль 3 — Frontend
Сделать:
- React/TypeScript UI;
- загрузку board из `fixtures/board.json` или `GET /board`;
- KPI input;
- portfolio board;
- hypothesis card;
- trace/source view;
- score breakdown;
- risks/skeptic block;
- DOE plan;
- rerun controls.

Done:
- UI работает без backend от fixture;
- карточка гипотезы отвечает на “почему”, “источник”, “риск”, “как проверить”.

## Роль 4 — Demo/Data/QA
Сделать:
- поддерживать fixtures и sample docs;
- следить, чтобы fixtures соответствовали `CONTRACTS.md`;
- проверять demo flow;
- готовить короткий pitch: проблема, pipeline, top-гипотеза, экспертный rerun;
- собирать acceptance checklist.

Done:
- demo можно пройти за 2 минуты;
- все компоненты используют один и тот же JSON;
- known gaps записаны как future work, а не маскируются.

## Интеграционные правила
- Никто не ждёт чужой код: все начинают от fixtures.
- Любое изменение JSON-контракта сначала попадает в `CONTRACTS.md`, затем в fixtures.
- Rust API — единственная точка для frontend после интеграции.
- Python Agent не общается напрямую с frontend.
- Если LLM недоступна, демо работает через mock extraction.
