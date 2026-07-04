# ARCHITECTURE.md — архитектура MVP

## Одной фразой
MVP — это объяснимая фабрика гипотез: Python извлекает факты из корпуса, Rust детерминированно
строит и ранжирует гипотезы, frontend показывает портфель и trace.

## Компоненты

### Rust Track: Contracts + Engine + API
Один Rust-разработчик владеет и ядром, и платформенным API.

Ответственность:
- `crates/contracts`: единые структуры данных;
- `crates/engine`: deterministic discovery/scoring;
- `crates/platform`: HTTP API поверх engine и fixtures;
- валидация JSON от Python Agent;
- rerun без повторного extraction.

Engine не содержит доменных слов. Слова вроде `flotation`, `hydrocyclone`, `пентландит`
живут только в fixtures, sample docs, domain pack и factories.

### Python Agent
Python Agent — волатильный слой входа (диагностика + извлечение).

Ответственность:
- **`POST /diagnose`** — детерминированный якорный парсер xlsx хвостов (БЕЗ LLM):
  loss_cells [класс крупности × минералогия] с тоннажом, извлекаемостью, диагнозом
  и `cell_ref`; правила диагнозов — из `diagnosis_config` pack;
- парсинг `txt/pdf` в текст (постранично);
- **Entity Resolver**: нормализация синонимов оборудования/минералов
  (гидроциклон = циклон = ГЦ-660) через словарь `synonyms` из pack + fuzzy matching;
- LLM extraction: claims по Pydantic-схеме с `source_page`, confidence установлен LLM;
- mock extraction для стабильного демо (возвращает `fixtures/extract_response.json`);
- endpoint `POST /extract`;
- возврат только JSON: `claims`, `entities`, `edges`.

Agent не ранжирует гипотезы и не ставит финальные статусы.

### Frontend
Frontend — демонстрационная витрина.

Ответственность:
- KPI input;
- portfolio board;
- hypothesis card;
- trace/source view;
- score breakdown;
- risks/skeptic block;
- DOE plan;
- rerun controls.

Frontend должен уметь работать от `fixtures/board.json` без backend, чтобы не блокироваться.

### Demo/Data/QA Track
Четвёртый участник владеет независимым треком данных и приёмки.

Ответственность:
- `fixtures/` (board, diagnostics ×4, extract_response);
- `packs/flotation-v1.yaml`, `factories/*.yaml`;
- `golden/expert_hypotheses.json` — ground truth для benchmark;
- `sample_docs/` (+ открытый корпус `sample_docs/open/`);
- проверка demo flow, видео, презентация;
- синхронизация контрактов между Rust, Python и frontend.

## Поток данных
```text
norn-hack/Пример N/Хвосты*.xlsx
  -> Python Agent /diagnose (детерминированный)
  -> DiagnosticsReport { loss_cells, diagnosis_summary, data_quality }

norn-hack/*.pdf + sample_docs/open/*.pdf
  -> Python Agent /extract (LLM под валидатором)
  -> ExtractResponse { claims, entities, edges }

оба -> Rust API validates JSON
  -> Rust Engine discover(graph+diagnostics, kpi_contract, domain_pack)
  -> BoardResponse { snapshot, diagnostics, hypotheses[] с economic_effect }
  -> Frontend: heatmap диагноза + портфель + карточка + benchmark view
```

## API MVP
- `POST /extract`: proxy или мок ответа агента.
- `POST /run`: запускает discovery по corpus/snapshot и KPI.
- `GET /board`: отдаёт текущий `BoardResponse`.
- `GET /hypothesis/:id`: отдаёт одну гипотезу.
- `POST /rerun`: меняет веса/constraints/excluded factors и пересчитывает ranking.

## Механизмы генерации гипотез (engine)

**Mechanism-path (P0)** — от KPI назад через диагноз-узлы с `addressable_tons > 0`
до доступных controllable-рычагов → гипотеза «управляй рычагом X».

**Substitution (P0)** — альтернативный рычаг с тем же механизмом → «замени X на Y».

**Gap-based (P0)** — диагноз с существенным тоннажом, к которому не ведёт ни один
ДОСТУПНЫЙ на фабрике рычаг → гипотеза «нужно новое оборудование/метод» (capex_class 3).

**Contradiction-based (P1)** — два claim с противоположным polarity на одном edge →
«определить граничное условие». **Analogy-based (P1)** — механизм покрыт у X,
у Y с теми же тегами не покрыт → «перенести механизм».

Все операторы работают только над `EdgeType` и тегами узлов. Никаких доменных слов в коде.

## Принцип независимой разработки
Все компоненты разрабатываются против fixtures и контрактов.

Если компонент умеет читать и отдавать согласованный JSON, он совместим с остальными частями.
Интеграция не должна ждать “идеального” extraction или финального UI.
