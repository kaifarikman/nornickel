# PROJECT_CONTEXT.md — архитектура

## Одной фразой
Не чат с нейронкой, а R&D-платформа: из литературы и отчётов — приоритизированный,
объяснимый, проверяемый портфель экспериментов.

## Поток (pipeline)
1. **Вход:** KPI-контракт (+ цены металлов, ограничения) · xlsx-отчёт по хвостам ·
   корпус литературы · domain pack · конфиг фабрики (factories/*.yaml).
2. **Python-сайдкар (волатильно):** `/diagnose` — детерминированный парсер xlsx
   (диагноз потерь, БЕЗ LLM) · `/extract` — claims из литературы (LLM под валидатором,
   с постраничными ссылками) → эмбеддинги/вектор-поиск → narrator (LLM, P1).
   Отдаёт только JSON. Ничего не решает.
3. **Rust-ядро (стабильно):** строит граф из claims, диагноз-узлы получают тоннаж
   из диагностики → фиксирует snapshot+hash (граница воспроизводимости) →
   Discovery Engine обходит граф НАЗАД от узла KPI generic-операторами →
   Scoring (kpi_impact от тонн × цены) + хард-фильтры (capex, доступность оборудования) →
   Skeptic-rules → собирает Hypothesis с trace и economic_effect.
4. **Rust-платформа:** Claim-стор (sqlite), axum-API, Tauri-оболочка (file dialog,
   скан папки, спавн сайдкара, десктоп-сборка).
5. **TS-фронт:** доска-портфель (Pareto) · карточка (trace/score/skeptic/DOE) ·
   rerun-чат · Manager View / Budget What-If · Data Readiness.

## Где LLM
Только на входе (extract) и выходе (skeptic/narrate). Открытия делает детерминированный код.

## Три стора
- Структурная БД — численные факты/эксперименты (значения, единицы, условия).
- Граф механизмов — `фактор → механизм → свойство → KPI` с источниками (для trace).
- Вектор-индекс — куски документов для поиска доказательств.

## Публичный API engine (точка входа)

```rust
// crates/engine/src/lib.rs
pub fn discover(
    graph: &Graph,           // петрограф, построенный из claims platform-ом
    contract: &KpiContract,  // цель + ограничения от пользователя
    pack: &DomainPack,       // веса, операторы, правила из packs/<name>.yaml
) -> Portfolio               // ранжированный список Hypothesis с trace и score_breakdown
```

Роль 1 (Rust Track) реализует engine и platform: platform вызывает эту функцию после
построения графа из claims. Других публичных функций engine не экспортирует.

## Generic-операторы (ядро не знает домена)

| Оператор | Что делает | Результат |
|----------|-----------|-----------|
| `mechanism_path` | идёт по incoming рёбрам mechanism/proxy от KPI до controllable | гипотеза «управляй фактором X» |
| `substitution` | ищет substitution-рёбра на пути | гипотеза «замени X на Y с тем же эффектом» |
| `gap` | комбинация факторов не встречается в claims | гипотеза «проверь A+B вместе» |
| `contradiction` | два claim с противоположным polarity на одном edge | гипотеза «найди граничное условие» |
| `analogy_transfer` | узел Y имеет теги как X, но без покрытого пути | гипотеза «перенеси механизм X на Y» |

Каждый оператор работает над `EdgeType` и тегами узлов, не над материаловедением.
Доменная начинка — из pack. См. `docs/SCORING.md`, `docs/DOMAIN_PACK.md` и `docs/WORKED_EXAMPLE.md`.

## Специализированные агенты (логические роли pipeline)

Это не отдельные процессы, а логические ответственности внутри Python-сайдкара и Rust-ядра.

| Агент | Реализован в | P0 / P1 |
|-------|-------------|---------|
| Diagnostic Agent — детерминированный парсер xlsx хвостов | Python sidecar POST /diagnose | P0 (критический путь) |
| Document Agent — парсинг txt/pdf постранично | Python sidecar | P0 |
| Entity Resolver — нормализация синонимов (по pack.synonyms) | Python sidecar | P0 |
| Graph Agent — petgraph из ExtractResponse + DiagnosticsReport | Rust platform | P0 |
| Gap Agent — оператор gap (диагноз без доступного рычага) | Rust engine | P0 |
| Contradiction Agent — оператор contradiction | Rust engine | P1 |
| Analogy Agent — оператор analogy_transfer | Rust engine | P1 |
| Scoring Agent — scoring + economic_effect + hard filters | Rust engine | P0 |
| Skeptic/Critic Agent — skeptic_rules engine | Rust engine | P1 |
| Narrator Agent — LLM объясняет hypothesis | Python sidecar POST /narrate | P1 |
| Novelty Agent — близость к открытому корпусу | Python sidecar POST /novelty | P1 |
| Experiment Agent — DOE plan | Rust engine (из pack) | P0 (базовый) |

**Ключевой принцип:** агенты не фантазируют. Каждый имеет строгий JSON-вход и JSON-выход. LLM задействован только в Document/Entity/Narrator агентах.

## Граница волатильности
Схема — boundary.svg. Закон — AGENTS.md.
