# prompt_rust.md — ночной бриф: Роль 1 (Rust Track)

Ты работаешь в проекте «Фабрика гипотез» (хакатон Норникель, кейс: флотация Cu-Ni руд,
снижение потерь металлов с хвостами). Твоя зона: `crates/contracts`, `crates/engine`,
`crates/platform`. Дедлайн сдачи проекта: 4 июля 23:59.

## Контекст кейса за 5 строк
Реальные данные: xlsx-отчёты по хвостам 4 фабрик уже распарсены в
`docs/fixtures/diagnostics_*.json` (потери металла по классам крупности × минералогии,
с диагнозом причины). Из литературы извлечены claims → граф знаний
(`docs/fixtures/extract_response.json`). Твой engine детерминированно ищет гипотезы:
от KPI назад через диагноз-узлы с тоннажом до управляемых рычагов, доступных на фабрике,
и считает деньги. LLM в engine НЕТ и не будет.

## Что прочитать сначала (по порядку)
1. `CONTRACTS.md` — ЕДИНСТВЕННЫЙ источник структур. Все типы уже определены.
2. `FINAL_SPRINT.md` — общий план и формула демо.
3. `docs/SCORING.md` — формулы скоринга, `docs/DOMAIN_PACK.md` — как читать pack.
4. `AGENT_RULES.md` — жёсткие законы (§1: ни одного доменного слова в engine).
5. Данные: `fixtures/board.json` (эталон ответа API), `fixtures/diagnostics_kgmk.json`,
   `fixtures/extract_response.json`, `packs/flotation-v1.yaml`, `factories/*.yaml`.

## P0 задачи (строго по порядку)
1. **`crates/contracts`** — структуры из CONTRACTS.md: `Claim`, `GraphNode`, `GraphEdge`,
   `KpiContract` (+`factory_id`, `prices_usd_per_t`), `DiagnosticsReport`/`LossCell`,
   `ScoreBreakdown`, `EconomicEffect`, `Hypothesis` (+`economic_effect`, `expert_match`),
   `BoardResponse` (+`diagnostics`), `DomainPack` (+`diagnosis_config`), `RerunAction`
   (+`change_price`), `FactoryConfig`. Экспорт TS-типов через `ts-rs` → `web/src/contracts.ts`.
2. **`crates/platform`, axum, порт 8080**: `GET /board` отдаёт `fixtures/board.json` как есть.
   С этого момента фронт разблокирован. Потом остальные эндпоинты.
3. **Построение графа** (platform): `ExtractResponse` → `petgraph::DiGraph<GraphNode, GraphEdge>`.
   Диагноз-узлы (tag `diagnosis`) получают `properties.addressable_tons` из
   `DiagnosticsReport.diagnosis_summary`. Рычаги с `equipment_required`, которого нет
   в `factories/<factory_id>.yaml` (или `present: false`), помечаются недоступными.
4. **`crates/engine`**: `pub fn discover(graph, contract, pack) -> Portfolio`.
   Оператор `mechanism_path`: от узла с tag `kpi` НАЗАД по incoming-рёбрам `mechanism`
   через диагноз-узлы с `addressable_tons > 0` до узлов с tag `controllable`.
   Гипотеза наследует `addressable_tons` своего диагноз-узла.
5. **Scoring**: `kpi_impact ∝ addressable_tons × mid(gain_range)/100 × price`
   (нормировать на максимум портфеля); остальные оси — SCORING.md. Веса из pack.
   Хард-фильтры: `equipment_not_available` (кроме gap-гипотез — см. п.9), `capex_class`
   из constraints. `economic_effect` вычисляется здесь же, с заполненными `assumptions`.
6. **Статусы** — пороги из CONTRACTS.md (recommended ≥ 0.75 и т.д.). Rank = порядок.
7. **`POST /run`** (diagnostics + extract из файлов/фикстур → граф → discover → BoardResponse),
   **`GET /hypothesis/:id`**, **`POST /rerun`** (exclude_factor, change_weight,
   add/relax_constraint, `change_price` — пересчёт денег и ranking без смены snapshot.hash).
8. **`GET /export/board.json` и `GET /export/board.csv`** — плоская выгрузка гипотез
   (rank, title, status, score_total, value_usd_lo/hi, trace через `;`). 30 минут работы,
   закрывает обязательное требование ТЗ.
9. **Оператор `gap`**: диагноз с tons > порога, к которому не ведёт ни один ДОСТУПНЫЙ рычаг →
   гипотеза «нужно новое оборудование/метод» из substitution/mechanism-рёбер недоступных
   рычагов (у них `capex_class: 3`). Так рождаются «магнитная сепарация» и «тонкое грохочение»,
   которые есть у экспертов в golden set.

## Правила
- В `crates/engine` НИ ОДНОГО доменного слова (flotation, nickel, Pnt, мельница, насадка...).
  Всё доменное — в pack, fixtures, factories. Проверка:
  `grep -riE "flotation|nickel|pnt|мельниц|насадк|хвост" crates/engine/src` → пусто.
- Engine не знает про element_28/29 как таковые — это ключи в map из контракта.
- Никакого LLM, никакой сети в engine. Один и тот же вход → байт-в-байт одинаковый выход.
- Изменение контракта → сначала CONTRACTS.md, потом код, в том же PR регенерить contracts.ts.

## Самопроверка (Done)
- `cargo test`: юнит-тест mechanism_path на графе из `fixtures/extract_response.json`
  + `fixtures/diagnostics_kgmk.json` → в топ-3 есть гипотеза с factor `node_hydrocyclone_nozzle`
  (сверься с `fixtures/board.json` — он эталон формата и порядка величин).
- `GET /board` отдаёт валидный BoardResponse.
- `POST /rerun` с `change_price` element_28 ×2 меняет `value_usd_range` всех гипотез.
- Повторный `POST /run` на тех же входах даёт тот же `snapshot.hash`.
- grep-проверка доменных слов в engine — пусто.

## НЕ делать (вырезано из спринта)
Tauri, sqlite-миграции (память + файлы достаточно), операторы contradiction/analogy,
NLP-парсинг rerun-фраз, аутентификация, фоновые ingest-джобы (файлы грузим синхронно).
