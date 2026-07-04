# BACKEND_MIGRATION.md — привести backend к актуальному контракту (флотация)

Бриф для агента Rust-разработчика. Контекст: backend в `backend/` написан по
устаревшему комплекту доков (alloys, до пивота). Ревью показало: архитектура и
engine добротные, **ничего не переписываем с нуля** — точечная миграция на
контракт из `docs/CONTRACTS.md` (коммит `5f017cf`+). Оценка: ~1 день.

Прочитать перед стартом: `docs/CONTRACTS.md` (весь), `docs/prompt_rust.md`,
`docs/docs/SCORING.md` (новая формула kpi_impact), `docs/FINAL_SPRINT.md` (контекст).

## Текущее состояние ревью

Главный диагноз: Rust/backend архитектурно собран нормально, но остался на старом
`alloys-v1` MVP, тогда как актуальный проект уже живёт во флотационном контракте
`flotation-v1`. Поэтому проблема не в том, что backend «плохой», а в том, что он
проверяет и отдаёт не тот продуктовый мир, который ждут docs, frontend и sidecar.

- `cargo test` в `backend/` проходит, но тестирует старые alloy fixtures и старый
  контракт. Это полезная регрессионная база по архитектуре, но не доказательство
  готовности к финальному флотационному кейсу.
- `frontend/src/contracts.ts`, `frontend/src/api.ts` и фикстуры фронта уже ждут
  `DiagnosticsReport`, `EconomicEffect`, `factory_id`, `prices_usd_per_t`,
  `change_price`, `{ run_id, board }` и endpoint'ы HTTP-шва.
- Python sidecar уже ближе к актуальному контракту: есть `/diagnose`, `/extract`,
  строгие Pydantic-модели, `source_page` и якорный XLSX-парсер. Его тесты в текущем
  локальном окружении не стартовали только из-за отсутствующей зависимости
  `pydantic_settings`, а не из-за найденной контрактной ошибки.
- Frontend-тесты в текущем окружении падают из-за Node `v25.2.1`: проект явно
  требует Node `>=22 <23`, а на Node 25 ломается jsdom/localStorage. Это отдельная
  проблема окружения, не сигнал о провале UI-логики.
- В `docs/fixtures`, `docs/packs/flotation-v1.yaml` и `docs/factories/*.yaml`
  уже лежит актуальный источник правды. `backend/fixtures` и `backend/packs` сейчас
  содержат старый alloy-контент и должны быть выведены из критического пути.

## Найденные расхождения

Эти расхождения обнаружены сравнением `docs/CONTRACTS.md`, `docs/FINAL_SPRINT.md`,
фронтового `contracts.ts`/`api.ts`, sidecar-моделей и фактического кода `backend/`.
Их надо исправлять именно как миграцию, а не как переписывание backend с нуля.

### Contracts

- В `crates/contracts` нет ключевых типов финального контракта: `DiagnosticsReport`,
  `LossCell`, `DiagnosisSummaryItem`, `DataQualityIssue`, `EconomicEffect`,
  `FactoryConfig`, `EquipmentItem`, `ExpertMatch`.
- `Claim` не содержит `source_page`, хотя PDF trace во фронте и sidecar держится
  на этом поле.
- `KpiContract` не содержит `factory_id` и `prices_usd_per_t`, поэтому backend
  не может считать деньги и выбирать factory diagnostics/equipment.
- `Hypothesis` не содержит `economic_effect` и `expert_match`, поэтому frontend
  не может показать value range и benchmark against experts от backend.
- `BoardResponse` не содержит `diagnostics`, хотя heatmap и Data Readiness требуют
  полный `DiagnosticsReport`.
- `RerunKind` не содержит `change_price`, хотя это обязательный live-rerun сценарий
  демо и тест parity фронта.

### Data

- `backend/fixtures/board.json` и `backend/packs/alloys-v1.yaml` относятся к
  старому alloy demo. Актуальные данные находятся в `docs/fixtures`,
  `docs/packs/flotation-v1.yaml`, `docs/factories/*.yaml`.
- Backend-тесты сейчас грузят `backend/fixtures/extract_response.json`,
  `backend/fixtures/board.json` и `backend/packs/alloys-v1.yaml`, поэтому они не
  ловят поломки флотационного контракта.
- Нет backend-теста, который десериализует все четыре
  `docs/fixtures/diagnostics_*.json`, хотя диагностика является центральным входом
  финального продукта.

### Engine

- `mechanism_path` сейчас строит путь от KPI до controllable без требования пройти
  через diagnosis-узел с `addressable_tons > 0`. Во флотационном кейсе это ключевой
  фильтр: гипотеза должна быть привязана к реальным тоннам потерь.
- `gap` реализован в старой alloy-семантике «комбинация факторов не покрыта
  корпусом». В финальном кейсе нужен gap по диагнозу, к которому ведут только
  недоступные рычаги/оборудование.
- `scoring.kpi_impact` сейчас зависит от confidence и длины пути, но не считает
  `addressable_tons × recovery_gain × price`. Поэтому backend не может выдавать
  экономический эффект, который является ядром демо.
- `cost_score` и hard constraints завязаны на `estimated_cost_delta_percent`.
  Актуальный контракт использует `capex_class` и доступность оборудования из
  `factories/*.yaml`.

### Platform API

- `POST /run` сейчас принимает обязательный `kpi_contract` и возвращает сразу
  `BoardResponse`. Фронт ждёт `{ factory_id, pack_id?, kpi_contract? }` и ответ
  `{ run_id, board }`.
- `POST /rerun` сейчас принимает голый `RerunAction`. Фронт и контракт ждут
  `{ run_id, action }`, чтобы пересчитывать конкретный run.
- `GET /board?run_id=` объявлен, но фактически run_id не влияет на выборку.
- Нет `GET /extract`, `GET /expert_hypotheses`, `GET /export/board.json`,
  `GET /export/board.csv`, хотя они описаны в HTTP-шве и нужны фронту/демо.
- Роуты backend сейчас не закрывают `/api/*` напрямую; фронт должен ходить через
  vite/nginx proxy с rewrite `/api -> /`, без CORS-хака.

### Integration Risk

Самый опасный сценарий: каждая часть по отдельности выглядит рабочей, но live
интеграция уходит в fixture fallback, потому что backend отдаёт старую форму.
Поэтому приёмку backend нельзя ограничивать `cargo test`; нужен parity-прогон
против фронтового HTTP-шва и актуальных `docs` fixtures.

## Что уже хорошо — НЕ ТРОГАТЬ

- Слои web/application/domain/infrastructure, DI в `state.rs`, тонкие хендлеры.
- `operators.rs`: mechanism_path / substitution / contradiction — обход корректен.
- Rerun-механика с сохранением snapshot.hash, валидация dangling edges, тесты
  determinism/rerun — сохранить как есть.
- Engine чист от доменных слов — так и держать (grep-проверка в конце).

---

## 1. `crates/contracts/src/lib.rs` — добавить недостающие типы

Все структуры и точные имена полей — в `docs/CONTRACTS.md`, здесь список дельт:

1.1. Новые структуры (секция DiagnosticsReport в CONTRACTS.md):
```rust
pub struct DiagnosticsReport { factory_id, pack_id, source_file, sections: Vec<String>,
    totals: Totals, loss_cells: Vec<LossCell>, diagnosis_summary: Vec<DiagnosisSummaryItem>,
    data_quality: Vec<DataQualityIssue> }
pub struct Totals { tails_smt: Option<f64>, element_28: ElementTotal, element_29: ElementTotal }
pub struct ElementTotal { pct: Option<f64>, tons: Option<f64> }
pub struct LossCell { section, size_class, mineral_form, element: String, tons: f64,
    share_of_class_pct: Option<f64>, recoverable: bool, diagnosis: String, cell_ref: String }
pub struct DiagnosisSummaryItem { diagnosis: String, element: String, tons: f64 }
pub struct DataQualityIssue { issue, location, handling: String,
    #[serde(default)] delta_pct: Option<f64> }
```
Эталон сериализации: `docs/fixtures/diagnostics_kgmk.json` — контракт-тест
«десериализуй все 4 файла diagnostics_*.json без ошибок» обязателен.

1.2. `EconomicEffect` (секция EconomicEffect в CONTRACTS.md):
```rust
pub struct EconomicEffect {
    addressable_tons: HashMap<String, f64>,
    recovery_gain_pct_range: [f64; 2],
    value_usd_range: [f64; 2],
    assumptions: Vec<String>,
}
```

1.3. `Hypothesis` — добавить поля:
```rust
pub economic_effect: EconomicEffect,
#[serde(default)] pub expert_match: Option<ExpertMatch>,
// pub struct ExpertMatch { matched: bool, expert_hypothesis_id: String }
```

1.4. `Claim` — добавить `#[serde(default)] pub source_page: Option<u32>`.

1.5. `KpiContract` — добавить:
```rust
pub factory_id: String,
#[serde(default)] pub prices_usd_per_t: HashMap<String, f64>,
```

1.6. `BoardResponse` — добавить `pub diagnostics: DiagnosticsReport`.

1.7. `RerunKind` — добавить вариант `ChangePrice`; в `RerunPayload` — поля
`element: Option<String>`, `usd_per_t: Option<f64>`.

1.8. `FactoryConfig` (секция FactoryConfig в CONTRACTS.md):
```rust
pub struct FactoryConfig { factory_id: String, tails_sections: Vec<String>,
    equipment: Vec<EquipmentItem> }
pub struct EquipmentItem { id: String, label: String, present: bool }
```
Эталон: `docs/factories/kgmk.yaml` (serde_yaml).

1.9. `DomainPack` — добавить `#[serde(default = "default_gain")] pub
default_gain_pct_range: [f64; 2]` (дефолт `[5.0, 15.0]`; поле уже добавлено
в `docs/packs/flotation-v1.yaml`).

1.10. `GraphNode` — helper'ы:
```rust
pub fn capex_class(&self) -> Option<u8>          // properties.capex_class
pub fn equipment_required(&self) -> Option<&str> // properties.equipment_required
pub fn addressable_tons(&self) -> HashMap<String, f64> // properties.addressable_tons
```
`cost_delta_percent()` больше не используется — удалить вместе с COST_PROPERTY (п. 4.2).

## 2. `crates/platform` — диагностика и фабрики в пайплайне

2.1. Новые порты в `application/ports.rs`:
```rust
pub trait DiagnosticsSource { fn load(&self, factory_id: &str) -> Result<DiagnosticsReport, _>; }
pub trait FactoryRepository { fn load(&self, factory_id: &str) -> Result<FactoryConfig, _>; }
```
Файловые адаптеры в `infrastructure/`: `fixtures/diagnostics_<factory_id>.json`,
`factories/<factory_id>.yaml` относительно base_dir.

2.1-бис. **Уход от моков — HTTP-адаптеры к сайдкару** (после того как файловый
путь заработал): `HttpDiagnosticsSource` → `POST http://127.0.0.1:8765/diagnose`
body `{factory_id, file_path, pack_id}` (пути xlsx фабрик — маленькая таблица
factory_id → `norn-hack/Пример N/Хвосты*.xlsx` в конфиге platform, НЕ в engine);
`HttpExtractSource` → `POST :8765/extract`. Выбор адаптера — env
`SIDECAR_URL` (задан → HTTP, нет → файлы). Ошибка/недоступен сайдкар → лог +
fallback на файловый адаптер (демо-страховка сквозная). Схемы ответов уже
контрактные — сайдкар их отдаёт байт-в-байт (проверено ревью).

2.2. `application/run.rs` — при построении графа, ПОСЛЕ загрузки extract:
- у каждого узла с tag `"diagnosis"`: найти в `diagnosis_summary` записи с
  `diagnosis == node.properties["diagnosis"]` и записать в
  `node.properties["addressable_tons"] = { element: tons, ... }`;
- у каждого узла с tag `"controllable"`: если `equipment_required` отсутствует
  в factory.equipment или `present == false` → `node.properties["available"] = false`
  (иначе true);
- factory_id брать из `kpi_contract.factory_id`.

2.3. `BoardResponse` собирать с `diagnostics` (полный отчёт, фронту нужен для heatmap).

2.4. `application/rerun.rs` — обработать `ChangePrice`: обновить
`kpi_contract.prices_usd_per_t[element]`, пересчитать economic_effect + kpi_impact +
score_total + статусы + rank. snapshot.hash НЕ меняется (тест уже есть — расширить).

## 3. `crates/engine/src/operators.rs` — деньги и доступность

3.1. `mechanism_path`: путь засчитывается, только если содержит узел с tag
`"diagnosis"` и суммой `addressable_tons > 0`. Кандидат получает
`diagnosis_node: Option<String>` (добавить в `Candidate`) — из него скоринг
возьмёт тонны. Путь через controllable с `available == false` — НЕ кандидат
mechanism_path (уйдёт в gap, см. 3.2).

3.2. `gap` — ЗАМЕНИТЬ семантику (старая «комбинация A+B» была под alloy-кейс).
Новая (docs/prompt_rust.md п.9): диагноз-узел с `addressable_tons` выше порога
(порог = 5% от суммы всех диагнозов), к которому ведут пути ТОЛЬКО через
недоступные рычаги → по кандидату на каждый такой недоступный рычаг:
`operator: "gap"`, `is_gap: true`, forced_status: None (пусть скоринг решает),
trace — claims пути. Это рождает гипотезы «магнитная сепарация» / «тонкое
грохочение» из golden set.

3.3. `contradiction` / `analogy_transfer` / `uncovered_constraint` — не трогать.

## 4. `crates/engine/src/scoring.rs` — новая формула (docs/docs/SCORING.md)

4.1. `kpi_impact` — двухпроходный:
```
проход 1 (по всем кандидатам): value_mid = Σ_el addressable_tons[el]
        * mid(pack.default_gain_pct_range)/100 * prices_usd_per_t[el]
проход 2: kpi_impact = (value_mid / max_value_mid_портфеля)
        * mean_confidence(path_claims) * (1 - 0.05*max(0, len(path)-2))
```
Кандидат без diagnosis_node → value_mid = 0 (contradiction/uncovered — ок,
их kpi_impact станет 0, статус живёт за счёт forced_status).

4.2. `cost_score` — заменить целиком:
```rust
match controllable.capex_class() { Some(1)=>1.0, Some(2)=>0.7, Some(3)=>0.35, _=>0.7 }
```
Удалить `COST_PROPERTY`, `COST_METRIC`, `cost_limit()` и их использование.

4.3. Новый выход скоринга — `EconomicEffect`:
`value_usd_range = [Σ tons*lo/100*price, Σ tons*hi/100*price]`,
`assumptions` = [`"price {el} = {price} $/t (параметр KpiContract)"`,
`"диагноз {diagnosis}: addressable_tons из DiagnosticsReport"`,
`"gain range {lo}-{hi}% — default_gain_pct_range пака"`]. Прикрепить к Hypothesis.

4.4. Хард-фильтр в сборке статуса: `capex_class` рычага против constraint
`{ metric: "capex_class", op: "<=" }` из контракта/пака → нарушение =
`rejected_by_constraints` (кроме gap-кандидатов: их смысл — новое оборудование;
им constraint применять как обычный, если пользователь явно ограничил capex — тогда rejected).

## 5. `crates/platform/src/web` — export + HTTP-шов с фронтом

5.1. `router.rs`: + `GET /export/board.json` (текущий BoardResponse как attachment),
+ `GET /export/board.csv`: колонки
`rank,id,title,status,score_total,value_usd_lo,value_usd_hi,capex_class,addressable_tons_28,trace`
(trace через `;`). Требование ТЗ, полчаса работы.

5.2. **HTTP-шов с фронтом — CONTRACTS.md, секция «HTTP-шов web ↔ platform»**
(зафиксирована по факту готового фронта; формы отличаются от текущих хендлеров):
- `POST /run`: body `{ factory_id, pack_id?, kpi_contract? }` (kpi_contract
  опционален → дефолтный контракт по factory_id: target recoverable_losses_element_28
  decrease, цены из fixtures). Ответ — **обёртка** `{ "run_id": "...", "board": BoardResponse }`
  (run_id у тебя уже есть в MemoryRunRepository — просто верни его наружу).
- `GET /board?run_id=` — по id; без run_id — последний прогон, иначе fallback
  fixtures/board.json (текущее поведение сохранить).
- `POST /rerun`: body `{ run_id, action }` (сейчас принимаешь голый RerunAction —
  добавить обёртку; run_id обязателен).
- + `GET /extract` — отдать текущий ExtractResponse (FileExtractSource уже есть).
- + `GET /expert_hypotheses` — отдать файл `golden/expert_hypotheses.json` из base_dir.
- **CORS НЕ добавлять**: фронт ходит через vite/nginx proxy `/api` → один origin.

5.3. Приёмка шва: у фронта есть `frontend/scripts/verify-parity.mjs` — при живом
бэке он гоняет /run + /rerun(change_price×2) и сверяет числа с эталоном. Он должен
пройти — это и есть Интеграция I.

## 6. Данные и конфиг — один источник правды

6.1. **Удалить** `backend/fixtures/` и `backend/packs/` (там старый alloy-контент).
Запуск: `NORNIKEL_ROOT=<repo>/docs cargo run` — в docs уже лежат актуальные
`fixtures/`, `packs/flotation-v1.yaml`, `factories/*.yaml`. Прописать в README backend.

6.2. Golden-тест: переименовать `golden_board_alloys_v1` →
`golden_board_flotation_v1`, перегенерить `tests/golden/board_flotation-v1.json`
прогоном engine на `docs/fixtures/extract_response.json` +
`docs/fixtures/diagnostics_kgmk.json` + `docs/packs/flotation-v1.yaml` +
`docs/factories/kgmk.yaml`. Старый `board_alloys-v1.json` удалить.

6.3. `ts-rs`: добавить в contracts как feature, `#[derive(TS)]` на все pub-типы,
генерация в `frontend/src/contracts.ts` (уточни путь у фронта). Если времени
нет — P1, но фронт тогда зеркалит типы руками.

## 7. Приёмка (Definition of Done миграции)

- [ ] Все 4 `docs/fixtures/diagnostics_*.json` десериализуются в DiagnosticsReport (тест).
- [ ] `docs/fixtures/board.json` десериализуется в BoardResponse (тест).
- [ ] `POST /run {factory_id: "kgmk", ...}` → в топ-3 гипотеза с factor
  `node_hydrocyclone_nozzle`, у неё `value_usd_range` ≈ `[4.0M, 11.9M]`
  (сверка: fixtures/board.json hyp_001; допуск на нормировку).
- [ ] Гипотеза от `gap` с недоступным рычагом (`node_fine_screening` или
  `node_magnetic_separation`) присутствует в портфеле kgmk.
- [ ] `POST /rerun {change_price, element_28, 33000}` удваивает value_usd_range,
  hash прежний.
- [ ] `GET /export/board.csv` отдаёт валидный CSV.
- [ ] `discover_is_deterministic` зелёный после всех правок.
- [ ] `grep -riE "flotation|nickel|pnt|мельниц|насадк|хвост|element_2" crates/engine/src` → пусто
  (element_28/29 — только ключи HashMap из данных, не литералы в коде engine).

## Порядок работы

1 → 6.1 (иначе будешь гонять тесты на старых данных) → 2 → 3 → 4 → 6.2 → 5 → 6.3 → 7.
Коммить по шагам, после каждого — `cargo test`.
