# ROLES.md — распределение по 4 ролям

> ⚠️ **УСТАРЕЛО НА ФИНАЛЬНЫЙ СПРИНТ.** Актуальное распределение под реальные данные кейса
> (флотация, хвосты) — в **`FINAL_SPRINT.md`**. Этот файл — историческая справка.

Актуальная схема MVP: **1 Rust / 1 Python Agent / 1 Frontend / 1 Demo-Data-QA**.
Rust Core и Rust Platform делает один разработчик, чтобы не плодить лишний шов внутри
самого рискованного контура.

## Час ноль (вместе, до первой строчки кода)
- Зафиксировать структуры контракта в `crates/contracts`:
  `GraphNode`, `GraphEdge{edge_type}`, `Claim`, `KpiContract`, `Hypothesis{trace, score_breakdown, doe_plan}`, `BoardResponse`.
- Сгенерить из них TS-типы (`ts-rs`) → `web/src/contracts.ts`.
- Зафиксировать схему domain pack (docs/DOMAIN_PACK.md).
- Договориться о фикстуре `fixtures/board.json` (3–5 гипотез) — фронт пилит против неё с минуты один.

---

## Роль 1 — Rust Track · Contracts + Discovery Engine + API
Один разработчик владеет Rust-контуром целиком: `crates/contracts`, `crates/engine`,
`crates/platform`.

**Делает:**
- Единые Rust-контракты и TS-экспорт для фронта.
- In-memory граф (`petgraph`).
- Generic-операторы обхода назад от KPI: mechanism-path, substitution, analogy, gap, process-window —
  над `EdgeType` и тегами узлов (`controllable`, `kpi`), не над материаловедением.
- Scoring-движок: взвешенная сумма + хард-фильтры; веса/пороги читаются из pack.
- Skeptic-rules engine: правила из pack.
- Сборка `Hypothesis` с `trace` и `score_breakdown`.
- axum-API поверх engine: `GET /board`, `GET /hypothesis/:id`, `POST /run`, `POST /rerun`.
- На MVP API сначала отдаёт fixtures, затем подключает engine.
**Первые часы:** контракты + `GET /board` из `fixtures/board.json` + engine-тест против фикстуры.
**Не делает:** PDF-парсинг, LLM, дизайн UI.

## Роль 2 — Python · агент-сайдкар → `sidecar`
Это волатильный слой — он перепишется при пивоте, остальное останется.
**Делает:**
- Парсинг PDF/DOCX/CSV → claims по схеме.
- LLM-извлечение под валидатором (pydantic), эмбеддинги + вектор-поиск.
- skeptic/narrator (LLM-рассуждение/объяснение). Отдаёт только JSON, ничего не решает.
- Оркестрация pipeline по тактам.
**Первые часы:** `POST /extract` — на вход пара PDF, на выход claims в схеме (LLM можно замокать).

## Роль 3 — Frontend · React/TS → `web`
Самый объёмный по площади; на нём держится демо.
**Делает:** ввод KPI-контракта · доска-портфель (Pareto+статусы) · карточка гипотезы
(trace/источники/score/skeptic/DOE) · rerun-чат · Manager View + Budget What-If · Data Readiness.
**Первые часы:** доска против `fixtures/board.json`, не ждёт бэк.
**Правила:** строгий TS, типы только из `contracts.ts` (см. web/docs/TYPESCRIPT.md).

## Роль 4 — Demo/Data/QA
Владелец демонстрационного набора и приёмки.
**Делает:**
- `fixtures/board.json` и `fixtures/extract_response.json`.
- `packs/alloys-v1.yaml`.
- `sample_docs/`.
- Проверку demo flow: documents → claims → graph → ranked hypotheses → trace → rerun.
- Короткий pitch и список known gaps.
**Первые часы:** фиксирует demo KPI, 3-5 гипотез и sample corpus, чтобы остальные роли не ждали.

---

## Сводка швов
- Python → Rust: JSON (claims), валидируется в platform.
- engine ↔ platform: Rust-вызовы внутри workspace (engine — библиотека, platform её зовёт).
- Rust → web: axum REST + сгенерированные TS-типы.
- pack: читают engine (правила/веса) и sidecar (что извлекать); единый файл в `packs/`.
