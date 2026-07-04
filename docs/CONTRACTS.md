# CONTRACTS.md — единый источник контракта

Это главный справочник. Все остальные файлы ссылаются сюда, но не дублируют.
Домен кейса: флотация Cu-Ni руд, минимизация потерь металлов с хвостами.
«Элемент 28» и «Элемент 29» — анонимизированные металлы из данных кейса; **в коде никогда
не раскрываем**, работаем с `element_28` / `element_29`, цены — параметры KpiContract.

## Общие правила
- JSON: `snake_case`, id — стабильные строки (`claim_001`, `node_hydrocyclone_nozzle`, `hyp_001`).
- Frontend только отображает `BoardResponse` — не придумывает данные.
- Python Agent только извлекает и диагностирует — не ставит `rank`, `score_total`, `status`.
- Rust API валидирует весь JSON от Python перед использованием.
- Изменение любой структуры → обновить этот файл + регенерировать `web/src/contracts.ts` в том же PR.

## Порты и эндпоинты
| Сервис | Порт | Эндпоинты |
|--------|------|-----------|
| Python sidecar | 8765 | `GET /health`, `POST /extract`, `POST /diagnose`, `POST /parse_constraints`, P1: `POST /novelty` |
| Rust platform (axum) | 8080 | `POST /run`, `POST /rerun`, `POST /constraints/parse`, `GET /board`, `GET /hypothesis/:id`, `GET /extract`, `GET /expert_hypotheses`, `GET /benchmark`, `GET /data_readiness`, `GET /trace/:id`, `GET /roadmap`, `GET /factories`, `GET /export/board.{json,csv}` |
| Frontend (Vite dev) | 5173 | — |

Platform читает данные из каталога `NORNIKEL_ROOT` (по умолчанию `docs/`). Если задан
env `SIDECAR_URL`, `/extract` и `/diagnose` берутся у живого сайдкара с файловым
fallback (демо-страховка); иначе — из `fixtures/`.

---

## DiagnoseRequest
> Rust Platform → Python Sidecar при `POST /diagnose`

```json
{
  "factory_id": "kgmk",
  "file_path": "norn-hack/Пример 1/Хвосты КГМК.xlsx",
  "pack_id": "flotation-v1"
}
```

| `factory_id` | Фабрика |
|---|---|
| `"kgmk"` | Пример 1 — КГМК |
| `"nof_vkr"` | Пример 2 — НОФ вкрапленная |
| `"nof_med"` | Пример 3 — НОФ медистая |
| `"tof"` | Пример 4 — ТОФ (две секции хвостов: породные + пирротиновые) |

Для скрытой фабрики `factory_id` — произвольная стабильная строка, а путь к xlsx
передаётся через `RunRequest.source_file`; sidecar `/diagnose` не ограничивает id
перечнем четырёх демо-фабрик.

---

## DiagnosticsReport
> Python Sidecar → Rust Platform (ответ `POST /diagnose`). Детерминированный, БЕЗ LLM.

```json
{
  "factory_id": "kgmk",
  "pack_id": "flotation-v1",
  "source_file": "norn-hack/Пример 1/Хвосты КГМК.xlsx",
  "sections": ["rock"],
  "totals": {
    "tails_smt": 5824591,
    "element_28": { "pct": 0.1784, "tons": 10392.3 },
    "element_29": { "pct": 0.0726, "tons": 4229.7 }
  },
  "loss_cells": [
    {
      "section": "rock",
      "size_class": "+71",
      "mineral_form": "closed_pnt_cp",
      "element": "element_28",
      "tons": 2088.3,
      "share_of_class_pct": 77.9,
      "recoverable": true,
      "diagnosis": "liberation_deficit",
      "cell_ref": "Итог!E44"
    }
  ],
  "diagnosis_summary": [
    { "diagnosis": "liberation_deficit",  "element": "element_28", "tons": 3005.0 },
    { "diagnosis": "slimes_overgrinding", "element": "element_28", "tons": 856.7 },
    { "diagnosis": "flotation_kinetics",  "element": "element_28", "tons": 512.4 },
    { "diagnosis": "not_recoverable",     "element": "element_28", "tons": 1130.9 }
  ],
  "data_quality": [
    { "issue": "ref_error", "location": "Итог! секция +125", "handling": "treated_as_zero" },
    { "issue": "checksum_mismatch", "location": "класс -10, element_29", "handling": "reported", "delta_pct": 1.8 }
  ]
}
```

| Поле | Правила |
|------|---------|
| `sections[]` | `"rock"` (породные) и/или `"pyrrhotite"` (пирротиновые — есть только у ТОФ) |
| `size_class` | как в отчёте: `"+125"`, `"-125 +71"` / `"+71"`, `"-71 +45"`, `"-45 +20"`, `"-20 +10"`, `"-10"` |
| `mineral_form` | `"open_pnt_cp"` \| `"closed_pnt_cp"` \| `"pyrrhotite_impurity"` \| `"silicate_valleriite"` \| `"pyrite_other_sulfides"` \| `"millerite"` |
| `recoverable` | по карте `recoverability` из pack: (element × mineral_form) → bool |
| `diagnosis` | id из pack: `liberation_deficit` \| `slimes_overgrinding` \| `flotation_kinetics` \| `not_recoverable` |
| `cell_ref` | `лист!ячейка` тоннажа — обязателен, на нём держится trace до исходника |
| `data_quality[].issue` | `"ref_error"` \| `"merged_cell"` \| `"empty_slot"` \| `"checksum_mismatch"` \| `"parse_warning"` |

Самопроверка парсера: суммы loss_cells по классу сверяются со строкой «Итого (проверка)»,
извлекаемость — со строкой «Извлекаемый металл»; расхождение > 1% → `checksum_mismatch`.

---

## ExtractRequest
> Rust Platform → Python Sidecar при `POST /extract`

```json
{
  "docs": [
    { "path": "norn-hack/Дополнительные материалы/geokniga-flotacionnye-metody-obogashcheniya_0.pdf", "mime": "application/pdf" },
    { "path": "docs/sample_docs/flotation/flotation_kinetics_notes.txt", "mime": "text/plain" },
    { "path": "docs/sample_docs/open/mdpi_pentlandite_fines_2023.pdf", "mime": "application/pdf" }
  ],
  "pack_id": "flotation-v1"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `docs[].path` | string | путь к файлу (относительный от корня проекта) |
| `docs[].mime` | enum | `"text/plain"` \| `"text/csv"` \| `"application/pdf"` \| `"application/vnd.openxmlformats-officedocument.wordprocessingml.document"` (docx) |
| `pack_id` | string | id domain pack, используется для нормализации |

---

## ExtractResponse
> Python Sidecar → Rust Platform

```json
{
  "pack_id": "flotation-v1",
  "documents": [
    {
      "id": "doc_flotation_methods",
      "title": "Флотационные методы обогащения",
      "path": "norn-hack/Дополнительные материалы/geokniga-flotacionnye-metody-obogashcheniya_0.pdf",
      "source_url": null
    },
    {
      "id": "doc_mdpi_fines",
      "title": "Recovery of fine pentlandite particles by flotation",
      "path": "docs/sample_docs/open/mdpi_pentlandite_fines_2023.pdf",
      "source_url": "https://www.mdpi.com/2075-163X/13/2/0000"
    }
  ],
  "claims": [],
  "entities": [],
  "edges": []
}
```

`source_url` — обязателен для открытых источников (бонус жюри), `null` для материалов кейса.

---

## Claim

```json
{
  "id": "claim_001",
  "text": "Уменьшение диаметра песковой насадки гидроциклона смещает границу разделения в тонкую сторону и снижает долю крупных классов в сливе.",
  "source_ref": "doc_flotation_methods",
  "source_page": 214,
  "confidence": 0.85,
  "evidence_type": "literature"
}
```

| `evidence_type` | Когда использовать |
|----------------|-------------------|
| `"literature"` | факт из учебника, статьи, справочника |
| `"experiment"` | факт из таблицы с данными (в т.ч. xlsx хвостов) |
| `"expert_note"` | комментарий эксперта в документе (методичка «Как читать отчет») |
| `"data_gap"` | явное указание на отсутствие данных |
| `"inferred"` | LLM вывел по косвенным признакам (ставить низкий confidence) |

`source_page` — обязателен для PDF (на нём держится «trace до страницы»), `null` для txt/csv.

---

## GraphNode

```json
{
  "id": "node_hydrocyclone_nozzle",
  "kind": "factor",
  "label": "диаметр песковой насадки гидроциклона",
  "tags": ["controllable"],
  "properties": {
    "unit": "inch",
    "capex_class": 1,
    "equipment_required": "hydrocyclone"
  }
}
```

| `kind` | Смысл | Примеры узлов |
|--------|-------|--------------|
| `"factor"` | управляемый рычаг: настройка/замена оборудования, режим, реагент | насадка ГЦ, футеровка мельницы, плотность пульпы, время агитации, реагент |
| `"mechanism"` | промежуточное физическое явление | граница разделения классификации, раскрытие сростков, кинетика флотации |
| `"property"` | измеримое свойство потока/продукта; **сюда же диагнозы потерь** | `node_loss_liberation_deficit`, гранулометрия слива |
| `"kpi"` | целевой или ограничивающий показатель | `node_recoverable_losses_element_28` |

| `tags[]` | Смысл |
|----------|-------|
| `"controllable"` | рычаг, которым можно управлять |
| `"kpi"` | целевой KPI (engine идёт от него назад) |
| `"constraint"` | KPI-ограничение (capex, производительность) |
| `"kpi_proxy"` | свойство, косвенно отражающее KPI |
| `"diagnosis"` | property-узел диагноза потерь; получает `addressable_tons` из DiagnosticsReport |

`properties` рычагов: `capex_class` — 1 = настройка режима, 2 = замена узла/детали,
3 = новое оборудование; `equipment_required` — id оборудования из `factories/<factory_id>.yaml`
(рычаг без такого оборудования на фабрике отсекается хард-фильтром `equipment_not_available`);
`lever_type` — тип рычага для бенчмарка против экспертов (`grinding` | `classification` |
`flotation` | `reagents` | `new_equipment` | `automation`, как в `ExpertHypothesis.lever_type`).

Диагноз-узлы (`tags: ["diagnosis"]`) создаются platform-ом из pack и получают
`properties.addressable_tons = { "element_28": 3005.0, "element_29": 411.2 }` из `diagnosis_summary`.

---

## GraphEdge

```json
{
  "id": "edge_001",
  "src": "node_hydrocyclone_nozzle",
  "dst": "node_separation_size",
  "edge_type": "mechanism",
  "mechanism": "classification_cut_size",
  "source_claims": ["claim_001", "claim_007"],
  "polarity": "negative"
}
```

| `edge_type` | Смысл |
|-------------|-------|
| `"mechanism"` | причинная связь: рычаг/механизм влияет на узел |
| `"proxy"` | косвенная связь |
| `"tradeoff"` | отрицательный побочный эффект (переизмельчение → шламы) |
| `"substitution"` | альтернативный рычаг с тем же эффектом (грохот ↔ гидроциклон) |

| `polarity` | Смысл |
|-----------|-------|
| `"positive"` | увеличение src → увеличение dst |
| `"negative"` | увеличение src → уменьшение dst |
| `"nonlinear"` | нелинейная зависимость (оптимум существует) |

`mechanism` — свободная строка-метка (живёт в данных, не в engine-коде).

---

## KpiContract

```json
{
  "factory_id": "kgmk",
  "target": {
    "metric": "recoverable_losses_element_28",
    "direction": "decrease",
    "minimum_delta_percent": 10
  },
  "constraints": [
    { "metric": "capex_class", "op": "<=", "value": 2, "unit": "class" }
  ],
  "prices_usd_per_t": { "element_28": 16500, "element_29": 9500 },
  "weights_override": { "cost": 0.3 },
  "excluded_factors": ["node_magnetic_separation"]
}
```

`prices_usd_per_t` — цены анонимизированных металлов, вводит пользователь (дефолты в fixtures).
`weights_override` и `excluded_factors` — опциональны, для rerun. `op`: `"<="` | `">="`.

---

## ScoreBreakdown

```json
{
  "kpi_impact": 0.86,
  "evidence": 0.88,
  "plausibility": 0.84,
  "cost": 0.92,
  "risk": 0.66,
  "novelty": 0.45
}
```

Все поля `[0.0, 1.0]`. `kpi_impact` считается от денег:
`addressable_tons × mid(recovery_gain_pct_range)/100 × price`, нормировано на максимум по
портфелю. Формулы — в `docs/SCORING.md`. Веса — в `DomainPack.scoring_weights`.

---

## EconomicEffect

```json
{
  "addressable_tons": { "element_28": 3005.0 },
  "recovery_gain_pct_range": [5, 15],
  "value_usd_range": [2479125, 7437375],
  "assumptions": [
    "price element_28 = 16500 $/t (параметр KpiContract)",
    "recovery gain range из claim_017 (консервативно)"
  ]
}
```

Вычисляет engine (не LLM): `value_usd = addressable_tons × gain/100 × price`, диапазон, не точка.
`assumptions` — обязательное поле: каждое число объяснимо (требование интерпретируемости ТЗ).

---

## DoePlan

```json
{
  "objective": "Проверить рост раскрытия закрытых сростков в классах +71/-71+45 после замены насадок.",
  "factors": ["диаметр песковой насадки", "давление на входе ГЦ"],
  "measurements": ["гранулометрия слива", "доля закрытого Pnt/Cp по классам", "извлечение element_28"],
  "minimum_runs": 6
}
```

---

## Hypothesis

```json
{
  "id": "hyp_001",
  "title": "Заменить песковые насадки гидроциклонов 12\" → 8\"",
  "summary": "Смещение границы разделения вернёт крупные сростки на доизмельчение и снизит потери закрытого Pnt/Cp в классах +71 и -71+45.",
  "status": "recommended",
  "rank": 1,
  "score_total": 0.82,
  "score_breakdown": { },
  "economic_effect": { },
  "trace": ["claim_001", "claim_007", "diag_kgmk_closed_71"],
  "source_nodes": ["node_hydrocyclone_nozzle", "node_separation_size", "node_loss_liberation_deficit"],
  "risks": ["рост циркулирующей нагрузки на мельницы — проверить производительность"],
  "missing_evidence": ["нет claim о влиянии на извлечение element_29"],
  "doe_plan": { },
  "expert_match": null
}
```

`trace` может ссылаться и на claims, и на loss_cells диагностики (id вида `diag_<factory>_<n>` —
platform присваивает при построении графа, фронт резолвит в `cell_ref` исходного xlsx).

`expert_match` — заполняется QA-скриптом при benchmark:
`null` | `{ "matched": true, "expert_hypothesis_id": "kgmk_h3" }`.

| `status` | Условие назначения (код, не LLM) |
|----------|----------------------------------|
| `"recommended"` | `score_total >= 0.75` и нет нарушений hard constraint |
| `"watch"` | `score_total >= 0.55` и нет нарушений |
| `"rejected_by_constraints"` | нарушен hard_constraint (включая `equipment_not_available`, `capex_class`) |
| `"needs_expert_review"` | constraint-метрика не покрыта ни одним claim |

---

## BoardResponse

```json
{
  "snapshot": {
    "id": "snapshot_kgmk_001",
    "hash": "sha256:...",
    "pack_id": "flotation-v1"
  },
  "kpi_contract": { },
  "diagnostics": { },
  "hypotheses": []
}
```

`diagnostics` — полный `DiagnosticsReport` (фронту для heatmap и Data Readiness).
`snapshot.hash` не меняется при rerun — меняется только ranking внутри `hypotheses[]`.

---

## DomainPack
> Rust internal — десериализуется из `packs/<pack_id>.yaml`, передаётся в `engine::discover()`

```json
{
  "pack_id": "flotation-v1",
  "scoring_weights": {
    "kpi_impact":   0.35,
    "evidence":     0.20,
    "plausibility": 0.15,
    "cost":         0.15,
    "risk":         0.10,
    "novelty":      0.05
  },
  "hard_constraints": [
    { "metric": "capex_class", "op": "<=", "value": 3.0 }
  ],
  "enabled_operators": ["mechanism_path", "substitution", "gap"],
  "skeptic_rules": [
    { "rule": "uncovered_constraint",       "threshold": 0.0 },
    { "rule": "low_evidence_top_candidate", "threshold": 0.55 }
  ],
  "diagnosis_config": {
    "size_class_groups": {
      "coarse": ["+125", "-125 +71", "+71", "-71 +45"],
      "medium": ["-45 +20", "-20 +10"],
      "fine":   ["-10"]
    },
    "recoverability": {
      "element_28": ["open_pnt_cp", "closed_pnt_cp", "millerite"],
      "element_29": ["open_pnt_cp", "closed_pnt_cp"]
    },
    "rules": [
      { "diagnosis": "liberation_deficit",  "when": { "mineral_form": "closed_pnt_cp", "size_group": ["coarse"] } },
      { "diagnosis": "slimes_overgrinding", "when": { "mineral_form": "open_pnt_cp",   "size_group": ["fine"] } },
      { "diagnosis": "flotation_kinetics",  "when": { "mineral_form": "open_pnt_cp",   "size_group": ["coarse", "medium"] } },
      { "diagnosis": "not_recoverable",     "when": { "recoverable": false } }
    ]
  }
}
```

`diagnosis_config` читают и sidecar (`/diagnose` присваивает diagnosis каждой loss_cell),
и engine (диагноз-узлы графа). Вся доменная семантика — здесь, не в коде.
`KpiContract.weights_override` перекрывает отдельные ключи `scoring_weights` при rerun.

---

## FactoryConfig
> `factories/<factory_id>.yaml` — оборудование фабрики (из схем флотации и регламентов кейса)

```yaml
factory_id: kgmk
tails_sections: [rock]
equipment:
  - { id: ball_mill,           label: "Шаровые мельницы",        present: true }
  - { id: hydrocyclone,        label: "Гидроциклоны",            present: true }
  - { id: spiral_classifier,   label: "Спиральные классификаторы", present: true }
  - { id: flotation_bank,      label: "Флотомашины",             present: true }
  - { id: fine_screen,         label: "Грохота тонкого грохочения", present: false }
  - { id: magnetic_separator,  label: "Магнитные сепараторы",    present: false }
  - { id: contact_tank,        label: "Контактные чаны",         present: true }
```

Platform читает при `POST /run`: рычаг с `equipment_required`, отсутствующим или
`present: false`, → хард-фильтр `equipment_not_available` (кроме гипотез от оператора `gap`,
которые прямо предлагают новое оборудование и помечаются `capex_class: 3`).

---

## Graph (Rust internal)

```rust
pub type Graph = petgraph::DiGraph<GraphNode, GraphEdge>;
```

Platform строит граф из `ExtractResponse` + диагноз-узлов из `DiagnosticsReport`,
передаёт `&Graph` в `engine::discover()`. Engine граф не строит и не хранит.

---

## RerunAction

```json
{ "kind": "exclude_factor",   "payload": { "factor_id": "node_magnetic_separation" } }
{ "kind": "change_weight",    "payload": { "dimension": "cost", "value": 0.3 } }
{ "kind": "add_constraint",   "payload": { "metric": "capex_class", "op": "<=", "value": 1 } }
{ "kind": "relax_constraint", "payload": { "metric": "capex_class", "op": "<=", "value": 3 } }
{ "kind": "change_price",     "payload": { "element": "element_28", "usd_per_t": 21000 } }
```

`change_price` пересчитывает `economic_effect` и `kpi_impact` всех гипотез — ranking может
измениться, snapshot.hash — нет.

---

## HTTP-шов web ↔ platform (единая форма, зафиксирована после появления обоих краёв)

Фронт ходит ТОЛЬКО на относительный путь `/api/*` (dev: vite proxy → `127.0.0.1:8080`,
prod: nginx `location /api/`). CORS-слой в platform НЕ добавляется — один origin.

### POST /run
```json
// запрос (kpi_contract опционален — дефолты бэка по factory_id)
{ "factory_id": "kgmk", "pack_id": "flotation-v1", "source_file": null, "kpi_contract": { } }
// ответ 200
{ "run_id": "run_0001", "board": { } }
```
`run_id` — идентификатор прогона в памяти platform; `board` — полный `BoardResponse`.
`source_file` задаётся для новой/скрытой фабрики: platform вызывает живой sidecar
`/diagnose` напрямую и не требует `fixtures/diagnostics_<factory_id>.json`.

### GET /board?run_id=run_0001
→ `BoardResponse` прогона. Без `run_id` — последний прогон, иначе fallback на
fixtures/board.json (404, если нет ни того ни другого — фронт уйдёт в фикстурный режим).

### POST /rerun
```json
{ "run_id": "run_0001", "action": { "kind": "change_price", "payload": { } } }
```
→ `BoardResponse` (тот же `snapshot.hash`).

### POST /constraints/parse
> Frontend → Rust Platform. Platform добавляет текущий `kpi_contract`, `pack_id` и
> controllable-факторы из run, затем проксирует в sidecar `POST /parse_constraints`.

```json
{ "run_id": "run_0001", "text": "цена элемента 28 = 33000, капзатраты запрещены" }
```

Ответ:
```json
{
  "actions": [
    { "kind": "change_price", "payload": { "element": "element_28", "usd_per_t": 33000 } },
    { "kind": "add_constraint", "payload": { "metric": "capex_class", "op": "<=", "value": 1 } }
  ],
  "kpi_contract_patch": {},
  "unparsed": []
}
```

Нераспознанные фрагменты возвращаются в `unparsed`; parser не должен выдумывать actions.

### POST /parse_constraints
> Rust Platform → Python Sidecar.

```json
{
  "text": "исключи гидроциклоны",
  "kpi_contract": { },
  "pack_id": "flotation-v1",
  "factors": [{ "id": "node_hydrocyclone_nozzle", "label": "диаметр песковой насадки гидроциклона" }]
}
```

Ответ — та же структура, что у `/constraints/parse`.

### GET /hypothesis/:id · GET /export/board.json · GET /export/board.csv
Как описано выше; export отдаёт `Content-Disposition: attachment`.

### GET /extract
→ текущий `ExtractResponse` (документы + claims — фронту для Library и trace-цитат).

### GET /expert_hypotheses
→ содержимое `golden/expert_hypotheses.json` (фронту для Benchmark view).

Ошибки — формат ApiError (ниже). Валидация ответов на фронте — мягкая: не прошла →
`console.warn` + фикстурный fallback (демо-страховка).

---

## ExpertHypothesis (golden set)
> `golden/expert_hypotheses.json` — эталон из docx «Гипотезы» кейса, для benchmark

```json
{
  "id": "kgmk_h3",
  "factory_id": "kgmk",
  "text": "Замена песковых насадок на гидроциклонах с уменьшением диаметра с 12 на 8",
  "lever_type": "classification",
  "diagnosis_hint": "liberation_deficit"
}
```

`lever_type`: `"grinding"` | `"classification"` | `"flotation"` | `"reagents"` | `"new_equipment"` | `"automation"`.
Правило матчинга: совпадает `lever_type` И `diagnosis_hint` == диагноз гипотезы. Platform
делает это автоматически (жадно, по рангу) и заполняет `Hypothesis.expert_match`.

---

## Аналитические эндпоинты (read-model поверх последнего/указанного прогона)

Все принимают `?run_id=` (иначе — последний прогон).

### GET /benchmark → BenchmarkReport
Сколько эталонных гипотез экспертов «переоткрыл» engine.
```json
{
  "factory_id": "kgmk",
  "expert_total": 5,
  "matched": 5,
  "coverage_pct": 100.0,
  "matches": [
    { "expert_hypothesis_id": "kgmk_h3", "expert_text": "Замена песковых насадок...",
      "hypothesis_id": "hyp_001", "hypothesis_title": "Tune ...",
      "lever_type": "classification", "diagnosis": "liberation_deficit" }
  ],
  "unmatched_expert_ids": []
}
```

### GET /data_readiness → DataReadiness
Честность о качестве исходного xlsx (из `DiagnosticsReport.data_quality`).
```json
{ "factory_id": "kgmk", "readiness_pct": 62.5, "loss_cells": 55, "issues_total": 33,
  "issues_by_type": { "ref_error": 33 }, "note": "55 loss cells parsed; 33 ... handled" }
```

### GET /trace/:hyp_id → TraceReport
Трассировка гипотезы до первоисточников: claims (с `source_page`) и ячейки xlsx (`cell_ref`).
```json
{ "hypothesis_id": "hyp_001",
  "claims": [ { "id": "claim_001", "text": "...", "source_ref": "doc_flotation_methods",
               "source_page": 212, "evidence_type": "literature" } ],
  "source_cells": [ { "cell_ref": "Итог!E44", "section": "rock", "size_class": "+71",
               "mineral_form": "closed_pnt_cp", "element": "element_28", "tons": 2088.28,
               "diagnosis": "liberation_deficit" } ] }
```

### GET /roadmap?run_id=&max_capex= → RoadmapPlan
Рекомендованный план действий с **честной де-дубликацией стоимости**: гипотезы одного
диагноза делят общий `addressable_tons`, поэтому их value не складывается. По каждому
диагнозу берётся лучшее (обычно самое дешёвое эффективное) действие; стоимость
суммируется только по РАЗНЫМ диагнозам и разносится по фазам capex. `max_capex` (1..3) —
бюджет. Пример: наивная сумма по 11 гипотезам ≈ $87M, честный roadmap ≈ $13M.
```json
{ "factory_id": "kgmk", "max_capex_class": 3,
  "total_value_usd_range": [4252215, 12756645], "covered_diagnoses": 2,
  "uncovered_diagnoses": [],
  "phases": [
    { "capex_class": 1, "label": "Фаза 1 — быстрые настройки режима (capex 1)",
      "value_usd_range": [4252215, 12756645],
      "items": [ { "diagnosis": "liberation_deficit", "hypothesis_id": "hyp_001",
                   "title": "Tune ...", "status": "recommended", "capex_class": 1,
                   "value_usd_range": [3955050, 11865150],
                   "addressable_tons": { "element_28": 4794.0 },
                   "alternatives": ["hyp_002", "hyp_006", "..."] } ] } ] }
```

### GET /factories → [FactorySummary]
Мультифабричная карта денег (прогон по всем фабрикам кейса).
```json
[ { "factory_id": "kgmk", "sections": ["rock"],
    "recoverable_tons": { "element_28": 7564.1, "element_29": 4229.8 },
    "opportunity_usd_mid": 16499044.0, "n_hypotheses": 11, "n_recommended": 5,
    "top_hypothesis": "Tune ...", "expert_coverage_pct": 100.0 } ]
```

---

## Формат ошибок (оба сервиса)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "edge src references unknown entity",
    "details": { "edge_id": "edge_009", "missing_node": "node_xyz" }
  }
}
```

| HTTP | Когда |
|------|-------|
| 400 | некорректный запрос (неверная структура JSON) |
| 422 | валидный JSON, но не прошёл бизнес-валидацию |
| 500 | внутренняя ошибка сервиса |

Отдельные коды: `"XLSX_PARSE_ERROR"` (diagnose не нашёл якорные маркеры),
`"CHECKSUM_MISMATCH"` (расхождение > 5% — данные повреждены, 422).
