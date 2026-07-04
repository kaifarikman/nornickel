#!/usr/bin/env python3
"""gen_board_fixture.py — собирает fixtures/board.json (демо-KGMK) из
fixtures/diagnostics_kgmk.json + fixtures/extract_response.json.

Это ФИКСТУРА для фронта и Rust API (не engine!): числа согласованы с реальной
диагностикой КГМК, гипотезы намеренно пересекаются с golden set экспертов
(насадки ГЦ, футеровка, тонкое грохочение, магнитная сепарация) + добавляют новые.

Запуск: python3 gen_board_fixture.py   (пути по умолчанию — от расположения скрипта)
"""

import json
from pathlib import Path

PRICES = {"element_28": 16500, "element_29": 9500}

# Декларативные заготовки гипотез: engine потом будет делать это сам.
# diagnosis → addressable_tons берётся из diagnosis_summary диагностики.
HYPOTHESES = [
    {
        "id": "hyp_001",
        "title": "Заменить песковые насадки гидроциклонов 12\" → 8\"",
        "summary": "Смещение границы разделения в тонкую сторону вернёт крупные сростки на доизмельчение и снизит потери закрытого Pnt/Cp в классах +71 и -71+45.",
        "diagnosis": "liberation_deficit",
        "factor": "node_hydrocyclone_nozzle",
        "trace_claims": ["claim_001", "claim_002", "claim_003", "claim_017"],
        "source_nodes": ["node_hydrocyclone_nozzle", "node_separation_size", "node_regrind_circuit", "node_liberation", "node_diag_liberation_deficit"],
        "gain_range": [5, 15],
        "score": {"kpi_impact": 0.95, "evidence": 0.85, "plausibility": 0.9, "cost": 0.95, "risk": 0.7, "novelty": 0.35},
        "risks": ["рост циркулирующей нагрузки на мельницы — проверить запас производительности"],
        "missing_evidence": ["нет claim о влиянии на извлечение element_29 напрямую"],
        "doe": {
            "objective": "Подтвердить рост раскрытия закрытого Pnt/Cp в крупных классах после смены насадок.",
            "factors": ["диаметр песковой насадки", "давление на входе ГЦ"],
            "measurements": ["гранулометрия слива", "доля закрытого Pnt/Cp по классам", "содержание element_28 в хвостах"],
            "minimum_runs": 6
        }
    },
    {
        "id": "hyp_002",
        "title": "Изменить геометрию футеровки шаровых мельниц",
        "summary": "Оптимизация профиля футеровки повышает эффективность измельчения и стабильность помола — меньше недоизмельчённых сростков без роста шламов.",
        "diagnosis": "liberation_deficit",
        "factor": "node_mill_liner_geometry",
        "trace_claims": ["claim_004", "claim_014", "claim_003"],
        "source_nodes": ["node_mill_liner_geometry", "node_grind_stability", "node_liberation", "node_diag_liberation_deficit"],
        "gain_range": [3, 10],
        "score": {"kpi_impact": 0.8, "evidence": 0.7, "plausibility": 0.8, "cost": 0.75, "risk": 0.6, "novelty": 0.4},
        "risks": ["эффект зависит от износа текущей футеровки", "простой мельницы на перефутеровку"],
        "missing_evidence": ["нет данных по текущему профилю футеровки КГМК"],
        "doe": {
            "objective": "Сравнить гранулометрию разгрузки до/после смены профиля футеровки.",
            "factors": ["профиль футеровки", "заполнение мелющей средой"],
            "measurements": ["гранулометрия разгрузки", "производительность", "удельный расход электроэнергии"],
            "minimum_runs": 4
        }
    },
    {
        "id": "hyp_003",
        "title": "Увеличить фронт первой контрольной флотации",
        "summary": "Раскрытый Pnt/Cp средних классов не извлекается из-за недостатка времени флотации — перераспределение фронта добавит время контрольной операции.",
        "diagnosis": "flotation_kinetics",
        "factor": "node_flotation_front",
        "trace_claims": ["claim_009", "claim_016"],
        "source_nodes": ["node_flotation_front", "node_flotation_recovery_kinetics", "node_diag_flotation_kinetics"],
        "gain_range": [5, 12],
        "score": {"kpi_impact": 0.55, "evidence": 0.75, "plausibility": 0.85, "cost": 0.9, "risk": 0.75, "novelty": 0.3},
        "risks": ["снижение качества концентрата при затянутой флотации"],
        "missing_evidence": ["нет кинетической кривой флотации для руды КГМК"],
        "doe": {
            "objective": "Снять кинетику контрольной флотации и определить оптимальное время.",
            "factors": ["время флотации", "расход собирателя"],
            "measurements": ["извлечение element_28 по времени", "качество концентрата"],
            "minimum_runs": 6
        }
    },
    {
        "id": "hyp_004",
        "title": "Грохота тонкого грохочения после 2-й стадии измельчения",
        "summary": "Грохочение разделяет по размеру, а не по плотности — точнее отсекает нераскрытые сростки на доизмельчение, чем гидроциклоны.",
        "diagnosis": "liberation_deficit",
        "factor": "node_fine_screening",
        "trace_claims": ["claim_011", "claim_002", "claim_003"],
        "source_nodes": ["node_fine_screening", "node_separation_size", "node_regrind_circuit", "node_liberation", "node_diag_liberation_deficit"],
        "gain_range": [8, 20],
        "score": {"kpi_impact": 0.9, "evidence": 0.7, "plausibility": 0.8, "cost": 0.35, "risk": 0.5, "novelty": 0.6},
        "risks": ["capex: закупка и монтаж грохотов", "площадка в цехе"],
        "missing_evidence": ["нет ТЭО для конкретной площадки КГМК"],
        "doe": {
            "objective": "Пилот: сравнить точность разделения грохот vs ГЦ на потоке 2-й стадии.",
            "factors": ["размер ячейки сетки", "нагрузка на грохот"],
            "measurements": ["гранулометрия продуктов", "доля закрытого Pnt/Cp в сливе", "извлечение"],
            "minimum_runs": 5
        }
    },
    {
        "id": "hyp_005",
        "title": "Магнитная сепарация надцелевого класса с доизмельчением в отдельном цикле",
        "summary": "Выделение пирротиновой фракции крупных классов магнитной сепарацией в отдельный цикл доизмельчения и дофлотации.",
        "diagnosis": "liberation_deficit",
        "factor": "node_magnetic_separation",
        "trace_claims": ["claim_012", "claim_002", "claim_016"],
        "source_nodes": ["node_magnetic_separation", "node_regrind_circuit", "node_liberation", "node_diag_liberation_deficit"],
        "gain_range": [10, 25],
        "score": {"kpi_impact": 0.92, "evidence": 0.6, "plausibility": 0.75, "cost": 0.3, "risk": 0.45, "novelty": 0.7},
        "risks": ["крупный capex (новое оборудование + отдельный цикл)", "магнитные свойства пирротина КГМК требуют подтверждения"],
        "missing_evidence": ["нет данных по магнитной восприимчивости пирротиновой фракции КГМК"],
        "doe": {
            "objective": "Лабораторная магнитная сепарация проб хвостов крупных классов.",
            "factors": ["напряжённость поля", "крупность питания"],
            "measurements": ["выход магнитной фракции", "содержание element_28/29 в фракциях"],
            "minimum_runs": 6
        }
    },
    {
        "id": "hyp_006",
        "title": "Снизить переизмельчение: контроль гранулометрии и стабилизация помола",
        "summary": "Раскрытый минерал в классе -10 мкм уже потерян для флотации — стабилизация питания (зазор дробилок) и режима помола сокращает генерацию шламов.",
        "diagnosis": "slimes_overgrinding",
        "factor": "node_crusher_gap_control",
        "trace_claims": ["claim_013", "claim_014", "claim_006", "claim_007"],
        "source_nodes": ["node_crusher_gap_control", "node_grind_stability", "node_slime_generation", "node_diag_slimes_overgrinding"],
        "gain_range": [3, 8],
        "score": {"kpi_impact": 0.6, "evidence": 0.75, "plausibility": 0.8, "cost": 0.7, "risk": 0.7, "novelty": 0.45},
        "risks": ["эффект размазан по всей цепочке — сложно изолировать вклад"],
        "missing_evidence": ["нет тренда гранулометрии питания мельниц КГМК"],
        "doe": {
            "objective": "Оценить связь стабильности питания и доли класса -10 мкм в хвостах.",
            "factors": ["зазор щели дробилки", "подача воды в мельницы"],
            "measurements": ["гранулометрия питания", "доля -10 мкм в хвостах", "потери раскрытого Pnt/Cp в -10"],
            "minimum_runs": 8
        }
    }
]

WEIGHTS = {"kpi_impact": 0.35, "evidence": 0.20, "plausibility": 0.15, "cost": 0.15, "risk": 0.10, "novelty": 0.05}


def main():
    here = Path(__file__).resolve().parent
    fixtures = here.parent / "fixtures"
    diag = json.loads((fixtures / "diagnostics_kgmk.json").read_text(encoding="utf-8"))

    addressable = {}
    for s in diag["diagnosis_summary"]:
        addressable.setdefault(s["diagnosis"], {})[s["element"]] = s["tons"]

    hypotheses = []
    for h in HYPOTHESES:
        tons28 = addressable.get(h["diagnosis"], {}).get("element_28", 0.0)
        lo, hi = h["gain_range"]
        value_lo = round(tons28 * lo / 100 * PRICES["element_28"])
        value_hi = round(tons28 * hi / 100 * PRICES["element_28"])
        score_total = round(sum(WEIGHTS[k] * v for k, v in h["score"].items()), 3)
        status = "recommended" if score_total >= 0.75 else ("watch" if score_total >= 0.55 else "needs_expert_review")
        hypotheses.append({
            "id": h["id"],
            "title": h["title"],
            "summary": h["summary"],
            "status": status,
            "rank": 0,
            "score_total": score_total,
            "score_breakdown": h["score"],
            "economic_effect": {
                "addressable_tons": {"element_28": tons28},
                "recovery_gain_pct_range": h["gain_range"],
                "value_usd_range": [value_lo, value_hi],
                "assumptions": [
                    f"price element_28 = {PRICES['element_28']} $/t (параметр KpiContract)",
                    f"диагноз {h['diagnosis']}: addressable_tons из diagnostics_kgmk.json",
                    "recovery gain range — консервативная оценка из trace-claims"
                ]
            },
            "trace": h["trace_claims"],
            "source_nodes": h["source_nodes"],
            "risks": h["risks"],
            "missing_evidence": h["missing_evidence"],
            "doe_plan": h["doe"],
            "expert_match": None
        })

    hypotheses.sort(key=lambda x: -x["score_total"])
    for i, h in enumerate(hypotheses, 1):
        h["rank"] = i

    board = {
        "snapshot": {"id": "snapshot_kgmk_fixture_001", "hash": "fixture-kgmk-001", "pack_id": "flotation-v1"},
        "kpi_contract": {
            "factory_id": "kgmk",
            "target": {"metric": "recoverable_losses_element_28", "direction": "decrease", "minimum_delta_percent": 10},
            "constraints": [{"metric": "capex_class", "op": "<=", "value": 3, "unit": "class"}],
            "prices_usd_per_t": PRICES
        },
        "diagnostics": diag,
        "hypotheses": hypotheses
    }
    out = fixtures / "board.json"
    out.write_text(json.dumps(board, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] board.json: {len(hypotheses)} гипотез, топ: «{hypotheses[0]['title']}» "
          f"(score {hypotheses[0]['score_total']}, до ${hypotheses[0]['economic_effect']['value_usd_range'][1]:,})")


if __name__ == "__main__":
    main()
