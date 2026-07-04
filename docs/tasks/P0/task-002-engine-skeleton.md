> ⚠️ Бэклог написан до пивота на флотационный кейс: имена данных сменились (flotation-v1, diagnostics, factories). Актуальные задачи — docs/prompt_*.md + docs/FINAL_SPRINT.md.

# P0 · task-002 · Скелет Discovery Engine  (Роль 1)
**Цель:** прогнать захардкоженный мини-граф до одной гипотезы с trace.
**Сделать:**
- petgraph-граф из примера `docs/WORKED_EXAMPLE.md` (Sc/aging) — как тестовая фикстура в коде.
- Оператор `mechanism_path` (generic: incoming по edge_type до tag `controllable`).
- Оператор `substitution` (generic: рёбра edge_type=substitution как альтернативный path).
- Минимальный scoring по формулам из `docs/SCORING.md` (kpi_impact + evidence) + хард-фильтр cost.
- Сборка `Hypothesis { trace, score_breakdown, status }`.

**Оператор `gap` — P0 stretch goal:** если mechanism_path + substitution готовы раньше времени, добавить gap для `hyp_004`. Если нет — hyp_004 в fixtures остаётся stub, gap переходит в P1.

**Done:** unit-тест и golden-тест на fixtures зелёные; в коде нет доменных слов (`crates/engine` grep чистый).
