# SCORING.md — формулы и правила ранжирования гипотез

## Итоговая формула

```
score_total = Σ (weight[dim] * score[dim])
```

Веса берутся из `DomainPack.scoring_weights`. Дефолт для flotation-v1:

| Измерение    | Вес  |
|-------------|------|
| kpi_impact  | 0.35 |
| evidence    | 0.20 |
| plausibility| 0.15 |
| cost        | 0.15 |
| risk        | 0.10 |
| novelty     | 0.05 |

`KpiContract.weights_override` перекрывает отдельные веса для rerun. Сумма весов после override не нормализуется принудительно — engine использует числа как есть. Это намеренно: пользователь явно указывает "cost важнее".

---

## Как считается каждый компонент

### kpi_impact ∈ [0, 1]
Экономический вес гипотезы: деньги, которые она адресует.

```
value_mid = addressable_tons[el]                # из диагноз-узла пути
          * mid(recovery_gain_pct_range) / 100  # из claims (консервативно)
          * prices_usd_per_t[el]                # из KpiContract
kpi_impact = (value_mid / max_value_mid_в_портфеле)
           * mean(confidence[c] for c in path_claims)
           * (1 - path_length_penalty)
```

`path_length_penalty = 0.05 * max(0, len(path) - 2)` — длинные цепи штрафуются.
Если пути нет или addressable_tons = 0 → `kpi_impact = 0`.
Тот же `value_usd_range` (lo/hi без нормировки) кладётся в `Hypothesis.economic_effect`
вместе с assumptions — каждое число объяснимо.

### evidence ∈ [0, 1]
Полнота и качество доказательной базы гипотезы.

```
evidence = mean(confidence[c] for c in hypothesis.trace)
         * min(1.0, len(trace) / 3.0)
```

Минимум 3 claim для полного score. Меньше — пропорциональный штраф.

### plausibility ∈ [0, 1]
Доля рёбер пути, подкреплённых `evidence_type = "literature"` или `"experimental"` (не `"inferred"`).

```
plausibility = n_grounded_edges / total_edges_in_path
```

### cost ∈ [0, 1]
Инверсия капитальных затрат рычага: `capex_class` из properties factor-узла.

```
cost = { 1: 1.0, 2: 0.7, 3: 0.35 }[capex_class]   # настройка / замена узла / новое оборудование
```

Если capex_class неизвестен → `cost = 0.7` (неопределённость, не штраф).

### risk ∈ [0, 1]
Инверсия рискованности: отсутствующие данные и противоречия снижают.

```
risk = 1.0
     - 0.1 * len(missing_evidence)
     - 0.15 * n_contradictions
```

Зажато в [0, 1].

### novelty ∈ [0, 1]
Насколько гипотеза предлагает непроверенную комбинацию.

```
если гипотеза из gap-оператора (combination_not_in_corpus):
    novelty = 0.8 - 0.1 * n_partial_matches
иначе:
    novelty = 0.3  # существующий путь, не новая комбинация
```

---

## Статусы (назначает код, не LLM)

| Условие | Статус |
|---------|--------|
| Нарушен любой `hard_constraint` | `rejected_by_constraints` |
| `score_total >= 0.75` И нет нарушений | `recommended` |
| `score_total >= 0.55` И нет нарушений | `watch` |
| Constraint-метрика не покрыта ни одним claim | `needs_expert_review` |
| Иначе | `watch` |

Правила применяются в порядке сверху вниз. Первое сработавшее — финальный статус.

---

## Rerun: что пересчитывается

При `POST /rerun` graph snapshot **не меняется**. Пересчитываются:

1. Применяются `excluded_factors` — пути через исключённые узлы обнуляются.
2. Применяются `weights_override` — обновляется весовой вектор.
3. Применяются новые constraints — повторная проверка hard_constraint для всех гипотез.
4. `change_price` — пересчёт `economic_effect.value_usd_range` и `kpi_impact` всех гипотез.
5. `score_total` пересчитывается по новым весам.
6. Статусы переназначаются.
7. Гипотезы ресортируются.

`BoardResponse.snapshot.hash` остаётся тем же — граф не изменился. Frontend показывает diff рейтинга.
