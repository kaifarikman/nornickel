# Фабрика гипотез — комплект финального спринта

Кейс: флотация Cu-Ni руд, снижение потерь металлов с хвостами (данные — `../norn-hack/`).
Дедлайн сдачи: **4 июля 23:59**.

## Быстрый старт: одна команда — один файл

Каждый участник открывает СВОЙ бриф, отдаёт его своему агенту (Claude Code / Codex / любой)
вместе с `CONTRACTS.md` — и работает автономно против fixtures:

| Роль | Бриф |
|------|------|
| Rust (contracts + engine + platform) | **`prompt_rust.md`** |
| Python (sidecar: /diagnose + /extract) | **`prompt_python.md`** |
| Frontend (heatmap + портфель + benchmark) | **`prompt_frontend.md`** |
| Demo / Data / QA (golden, корпус, видео) | **`prompt_demo_qa.md`** |

Общий план, таймлайн и формула демо: **`FINAL_SPRINT.md`**.
Дельта по итогам QA-сессии 3.07 (как будут проверять + задачи по ролям): **`QA_DEBRIEF.md`**.

Запуск для приёмки из корня проекта: `docker compose up --build` → frontend на
`http://localhost`, platform на `:8080`, sidecar на `:8765`.

## Порядок чтения (для любого участника)
1. **FINAL_SPRINT.md** — что строим и почему, таймлайн, что вырезано.
   Затем **QA_DEBRIEF.md** — дельта после QA-сессии, приоритеты финальных часов.
2. **CONTRACTS.md** — единственный источник JSON-структур.
3. Свой `prompt_*.md` — задачи P0 по порядку, DoD, что НЕ делать.
4. **DEMO_SCENARIO.md** — 5-минутный сценарий, под который всё собирается.

## Данные и скрипты (уже готовы, проверены)
- `fixtures/diagnostics_{kgmk,nof_vkr,nof_med,tof}.json` — диагностика из реальных xlsx
  (4/4 фабрики, суммы сверены с исходниками).
- `fixtures/extract_response.json` — 20 флотационных claims + граф (эталон /extract).
- `fixtures/board.json` — эталон BoardResponse (6 гипотез с деньгами, КГМК).
- `golden/expert_hypotheses.json` — 27 гипотез экспертов (ground truth для benchmark).
- `packs/flotation-v1.yaml` — вся доменная семантика; `factories/*.yaml` — оборудование.
- `scripts/gen_diagnostics.py` — парсер xlsx (ядро будущего /diagnose),
  `gen_golden.py`, `gen_board_fixture.py`, `validate_fixtures.py` (гонять после
  любого изменения fixtures).
- `sample_docs/flotation/*.txt` — выжимки для отладки extract; `sample_docs/open/` —
  сюда QA складывает открытый корпус.

## Инженерные законы (не менялись)
- **AGENTS.md** — граница волатильности; **AGENT_RULES.md** — жёсткие запреты
  (ни одного доменного слова в engine).
- **docs/DOMAIN_PACK.md** — домен живёт в данных; **docs/WORKED_EXAMPLE.md** —
  сквозной пример «насадки ГЦ» (эталон для engine-теста).
- **docs/SCORING.md** — формулы; **docs/API_CONVENTIONS.md** — эндпоинты;
  **DEFINITION_OF_DONE.md** — критерии готовности.

> Файлы `ROLES.md`, `TASKS.md`, `*_tasks.md`, `agents/*`, `tasks/P0|P1` помечены
> устаревшими — вся актуальная работа в брифах и FINAL_SPRINT.md.
