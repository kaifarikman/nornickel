# WORKED_EXAMPLE.md — «насадки гидроциклона» через generic-операторы

Цель — показать, что «абстрактный обход» это не лозунг, а конкретный код, который
не знает ни слова «флотация». Этот пример — эталон для юнит-теста engine
(полные данные — `fixtures/extract_response.json` + `fixtures/diagnostics_kgmk.json`).

## Вход (всё — данные, не код)
KPI-контракт: `recoverable_losses_element_28 decrease`, ограничение `capex_class <= 3`,
цена `element_28 = 16500 $/t`.

Диагностика (из `/diagnose`, детерминированно): диагноз-узел `node_diag_liberation_deficit`
получает `addressable_tons = { element_28: 4794 }` — столько тонн потерь классифицировано
как «недораскрытие сростков» (закрытый Pnt/Cp в крупных классах).

Claims (из сайдкара):
- C1 [учебник, стр. 212]: «уменьшение насадки ГЦ смещает границу разделения в тонкую сторону»
  → edge `node_hydrocyclone_nozzle --mechanism--> node_separation_size`, nozzle.tags=[controllable]
- C2 [учебник, стр. 148]: «возврат крупных классов на доизмельчение повышает раскрытие»
  → цепочка `separation_size → regrind_circuit → liberation`
- C3 [методичка кейса]: «закрытые зёрна в крупных классах извлекаемы после доизмельчения»
  → edge `liberation --mechanism--> node_diag_liberation_deficit` (polarity negative)
- C17 [учебник, стр. 176]: «улучшение классификации даёт прирост раскрытия 5–15%»
  → gain_range для economic_effect

Граф: `node_diag_liberation_deficit --mechanism--> node_recoverable_losses_element_28` (tag kpi).

## Что делает engine (generic)
1. Старт у узла с tag `kpi`.
2. Оператор `mechanism_path`: идём по **incoming** рёбрам типа `mechanism` через узел
   с tag `diagnosis` и `addressable_tons > 0`, пока не упрёмся в узел с tag `controllable`.
   Путь: `kpi ← diag_liberation_deficit ← liberation ← regrind ← separation_size ← nozzle`.
   **Оператор не знает слов «гидроциклон» и «сростки»** — только edge_type и теги.
3. Доступность: у `nozzle` есть `equipment_required: hydrocyclone`; в `factories/kgmk.yaml`
   hydrocyclone `present: true` → рычаг доступен. (Будь он недоступен — хард-фильтр
   `equipment_not_available`, а оператор `gap` предложил бы недоступные рычаги как
   «новое оборудование», capex_class 3.)
4. Экономика: `value_usd_range = 4794 т × [5..15]% × 16500 $/т = [$3.96M .. $11.87M]`.
   `assumptions` заполняются из источников чисел.
5. Scoring (веса из pack): `kpi_impact` от value (нормировано на максимум портфеля),
   evidence = 4 claims, plausibility = связность механизма, cost = capex_class 1.
6. Хард-фильтр `capex_class <= 3` — проходит. Статус по порогу score_total.
7. Skeptic-rule `uncovered_constraint`: если constraint-метрика не покрыта claims → флаг.
8. Сборка `Hypothesis{ trace:[C1,C2,C3,C17, diag-ссылка], economic_effect, score, doe_plan }`.

## Мораль
Гидроциклон, Pnt/Cp, тонны, цена — всё в claims, diagnostics и pack (данные).
В `crates/engine` лежит только `follow_incoming(edge_type, until: tag)`, scoring-формула
и rule-engine. Смена домена (катализаторы, лекарства) → новый pack + новые claims,
обход тот же. Тест: результат этого примера должен совпадать с `fixtures/board.json`
по топ-гипотезе (hyp_001, «насадки 12→8»).
