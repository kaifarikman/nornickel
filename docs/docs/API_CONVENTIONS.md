# API_CONVENTIONS.md

## Принципы
- Единственный источник структур — `crates/contracts` (serde). TS-типы генерятся (`ts-rs`).
- Граница Python↔Rust — только JSON. Rust валидирует на входе. Без PyO3.
- snake_case в JSON. Версия контракта в заголовке `X-Contract-Version`.
- Ошибка: `{ "error": { "code": str, "message": str, "details": any } }`, HTTP 4xx/5xx.

## Python-сайдкар (порт 8765) — «ничего не решает»
- `POST /diagnose` body: {factory_id, file_path, pack_id} → DiagnosticsReport (детерминированный парсер xlsx хвостов, БЕЗ LLM; см. CONTRACTS.md)
- `POST /extract`  body: {docs:[{path,mime}], pack_id} → {claims:[Claim], entities, edges}
- `POST /embed`    body: {texts:[str]} → {vectors:[[f32]]}
- `POST /novelty`  body: {hypothesis_text} → {novelty_score, similar:[{doc,page,score}]} (P1: близость к открытому корпусу)
- `POST /skeptic`  body: {hypothesis} → {objection, missing_evidence, risks} (P1)
- `POST /narrate`  body: {hypothesis} → {text} (P1)

## Платформа axum (порт 8080)
- `POST /ingest`          body: {folder, pack_id} → стартует фоновую задачу → {job_id}
- `GET  /ingest/:job_id`  → {status: "pending"|"running"|"done"|"error", progress?: int, snapshot_id?: str, error?: str}
- `POST /run`             body: {snapshot_id, kpi_contract, pack_id} → {board: BoardResponse}
- `POST /rerun`           body: {run_id, action} → пересчёт нужного этапа → {board}
- `GET  /board?run_id=`   → BoardResponse
- `GET  /hypothesis/:id`  → Hypothesis (trace, score, skeptic, doe)

- `GET  /export/board.json` и `GET /export/board.csv` — выгрузка текущего портфеля (требование ТЗ «экспорт CSV/JSON»)

### Rerun action (enum)
```json
{
  "kind": "exclude_factor" | "relax_constraint" | "add_constraint" | "change_weight" | "change_price",
  "payload": {
    "factor_id": "...",              // для exclude_factor
    "constraint_kpi": "capex_class", // для relax/add_constraint
    "op": "<=", "value": 2,          // для relax/add_constraint
    "dimension": "kpi_impact",       // для change_weight
    "value": 0.35,                   // для change_weight
    "element": "element_28",         // для change_price
    "usd_per_t": 21000               // для change_price
  }
}
```

## Pack loading — кто и когда читает
- **Роль 1 (Rust Track/platform)** читает `packs/<pack_id>.yaml` при старте `POST /run` → десериализует в `DomainPack` struct → передаёт в `engine::discover()`. Также читает `factories/<factory_id>.yaml` для хард-фильтра `equipment_not_available`.
- **Роль 2 (sidecar)** читает тот же pack при `POST /extract` (нормализация, промпты) и при `POST /diagnose` (`diagnosis_config`: пороги классов, recoverability, правила диагнозов). Pack не кешируется между запросами на этапе хакатона.

## Ключевые типы (контракт)
KpiContract{factory_id, target, constraints[], prices_usd_per_t} ·
DiagnosticsReport{totals, loss_cells[], diagnosis_summary[], data_quality[]} ·
Claim{id,text,source_ref,source_page,confidence} ·
GraphNode{id,kind,tags[]} · GraphEdge{src,dst,edge_type,mechanism,source_claims[]} ·
ScoreBreakdown{kpi_impact,evidence,plausibility,cost,risk,novelty} ·
Hypothesis{id,status,trace[],score_breakdown,economic_effect,expert_match,doe_plan} ·
BoardResponse{snapshot,kpi_contract,diagnostics,hypotheses[]}
