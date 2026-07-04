#!/usr/bin/env python3
"""gen_golden.py — парсер docx «Гипотезы <фабрика>» → golden/expert_hypotheses.json.

Это ground truth для benchmark: QA сравнивает вывод системы с гипотезами
экспертного мозгового штурма (формат ExpertHypothesis — см. docs/CONTRACTS.md).

lever_type проставляется словарём ключевых слов; поле нужно для правила матчинга
(совпадает lever_type + пересекается диагноз → кандидат на match).

Запуск:
    python3 gen_golden.py [путь_к_norn-hack] [папка_вывода]
Дефолты: ../../norn-hack и ../golden.
"""

import json
import re
import sys
import zipfile
from pathlib import Path

FACTORIES = {
    "kgmk":    "Пример 1/Гипотезы КГМК.docx",
    "nof_vkr": "Пример 2/Гипотезы НОФ вкр.docx",
    "nof_med": "Пример 3/Гипотезы НОФ мед.docx",
    "tof":     "Пример 4/Гипотезы ТОФ.docx",
}

# (подстрока в тексте гипотезы) → (lever_type, diagnosis_hint); первое совпадение
LEVER_RULES = [
    ("реагент",            ("reagents",       "flotation_kinetics")),
    ("finfix",             ("reagents",       "flotation_kinetics")),
    ("флотац",             ("flotation",      "flotation_kinetics")),
    ("контактн",           ("flotation",      "flotation_kinetics")),
    ("агитац",             ("flotation",      "flotation_kinetics")),
    ("плотност",           ("flotation",      "flotation_kinetics")),
    ("магнитн",            ("new_equipment",  "liberation_deficit")),
    ("грохо",              ("new_equipment",  "liberation_deficit")),
    ("гидроциклон",        ("classification", "liberation_deficit")),
    # «классифик» ловит и опечатку «классификторах» из исходного docx НОФ-вкр
    ("классифик",          ("classification", "liberation_deficit")),
    ("насад",              ("classification", "liberation_deficit")),
    ("дробилк",            ("grinding",       "liberation_deficit")),
    ("дроблени",           ("grinding",       "liberation_deficit")),
    ("зазор",              ("grinding",       "liberation_deficit")),
    ("футеровк",           ("grinding",       "liberation_deficit")),
    ("измельчен",          ("grinding",       "liberation_deficit")),
    ("мелющ",              ("grinding",       "liberation_deficit")),
    ("мелящ",              ("grinding",       "liberation_deficit")),
    ("шаров",              ("grinding",       "liberation_deficit")),
    ("шары",               ("grinding",       "liberation_deficit")),
    ("гранулометри",       ("grinding",       "slimes_overgrinding")),
    ("мельниц",            ("grinding",       "liberation_deficit")),
    ("автоматизац",        ("automation",     None)),
    ("автоматическ",       ("automation",     None)),
    ("регулировани",       ("automation",     None)),
    ("подач",              ("automation",     None)),
    ("скорост",            ("automation",     None)),
]


def docx_text(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    # <w:p> → перенос строки, теги — вон
    xml = re.sub(r"</w:p>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    return text


def parse_hypotheses(path, factory_id):
    """Строки вида '1. <текст>' → список ExpertHypothesis."""
    items = []
    for line in docx_text(path).splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        m = re.match(r"^(\d+)\s*[.)]\s*(.+)$", line)
        if not m:
            continue
        text = m.group(2).strip()
        low = text.lower()
        lever_type, diagnosis_hint = "other", None
        for key, (lt, dh) in LEVER_RULES:
            if key in low:
                lever_type, diagnosis_hint = lt, dh
                break
        items.append({
            "id": f"{factory_id}_h{m.group(1)}",
            "factory_id": factory_id,
            "text": text,
            "lever_type": lever_type,
            "diagnosis_hint": diagnosis_hint,
        })
    return items


def main():
    here = Path(__file__).resolve().parent
    data_root = Path(sys.argv[1]) if len(sys.argv) > 1 else here.parent.parent / "norn-hack"
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else here.parent / "golden"
    out_dir.mkdir(parents=True, exist_ok=True)

    all_items = []
    for factory_id, rel in FACTORIES.items():
        path = data_root / rel
        if not path.exists():
            print(f"[SKIP] {factory_id}: {path} не найден")
            continue
        items = parse_hypotheses(path, factory_id)
        all_items.extend(items)
        levers = ", ".join(f"{i['id'].split('_h')[1]}:{i['lever_type']}" for i in items)
        print(f"[OK] {factory_id}: {len(items)} гипотез ({levers})")

    out = out_dir / "expert_hypotheses.json"
    out.write_text(json.dumps(all_items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nИтого {len(all_items)} эталонных гипотез → {out}")


if __name__ == "__main__":
    main()
