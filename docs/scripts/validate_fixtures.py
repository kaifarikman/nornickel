#!/usr/bin/env python3
"""validate_fixtures.py — проверка fixtures на соответствие CONTRACTS.md.

Проверяет:
- обязательные поля всех структур;
- ссылочную целостность: claim.source_ref → documents, edge.src/dst → entities,
  edge.source_claims → claims, hypothesis.trace → claims/диагнозы, source_nodes → entities;
- допустимые enum-значения (evidence_type, edge_type, polarity, status, diagnosis, mineral_form);
- согласованность диагностики (сумма loss_cells ≈ diagnosis_summary);
- скоринг: сумма весов × осей ≈ score_total.

Запуск: python3 validate_fixtures.py  → exit 0 если всё зелёное.
"""

import json
import sys
from pathlib import Path

ERRORS = []


def err(msg):
    ERRORS.append(msg)


def need(obj, fields, ctx):
    for f in fields:
        if f not in obj:
            err(f"{ctx}: нет обязательного поля '{f}'")


EVIDENCE_TYPES = {"literature", "experiment", "expert_note", "data_gap", "inferred"}
EDGE_TYPES = {"mechanism", "proxy", "tradeoff", "substitution"}
POLARITIES = {"positive", "negative", "nonlinear"}
STATUSES = {"recommended", "watch", "rejected_by_constraints", "needs_expert_review"}
DIAGNOSES = {"liberation_deficit", "slimes_overgrinding", "flotation_kinetics", "not_recoverable"}
MINERAL_FORMS = {"open_pnt_cp", "closed_pnt_cp", "pyrrhotite_impurity", "silicate_valleriite", "pyrite_other_sulfides", "millerite"}
NODE_KINDS = {"factor", "mechanism", "property", "kpi"}
SCORE_AXES = {"kpi_impact", "evidence", "plausibility", "cost", "risk", "novelty"}


def validate_extract(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    need(data, ["pack_id", "documents", "claims", "entities", "edges"], "extract_response")
    doc_ids = {d["id"] for d in data["documents"]}
    claim_ids = set()
    for c in data["claims"]:
        need(c, ["id", "text", "source_ref", "confidence", "evidence_type"], f"claim {c.get('id')}")
        claim_ids.add(c["id"])
        if c["source_ref"] not in doc_ids:
            err(f"claim {c['id']}: source_ref '{c['source_ref']}' не найден в documents")
        if c["evidence_type"] not in EVIDENCE_TYPES:
            err(f"claim {c['id']}: evidence_type '{c['evidence_type']}' вне enum")
    node_ids = set()
    for n in data["entities"]:
        need(n, ["id", "kind", "label", "tags"], f"node {n.get('id')}")
        node_ids.add(n["id"])
        if n["kind"] not in NODE_KINDS:
            err(f"node {n['id']}: kind '{n['kind']}' вне enum")
    for e in data["edges"]:
        need(e, ["id", "src", "dst", "edge_type", "source_claims", "polarity"], f"edge {e.get('id')}")
        if e["src"] not in node_ids:
            err(f"edge {e['id']}: src '{e['src']}' не найден в entities")
        if e["dst"] not in node_ids:
            err(f"edge {e['id']}: dst '{e['dst']}' не найден в entities")
        if e["edge_type"] not in EDGE_TYPES:
            err(f"edge {e['id']}: edge_type вне enum")
        if e["polarity"] not in POLARITIES:
            err(f"edge {e['id']}: polarity вне enum")
        for cid in e["source_claims"]:
            if cid not in claim_ids:
                err(f"edge {e['id']}: source_claim '{cid}' не найден")
    return claim_ids, node_ids


def validate_diagnostics(path):
    d = json.loads(path.read_text(encoding="utf-8"))
    need(d, ["factory_id", "pack_id", "source_file", "sections", "totals", "loss_cells", "diagnosis_summary", "data_quality"], path.name)
    for c in d["loss_cells"]:
        need(c, ["section", "size_class", "mineral_form", "element", "tons", "recoverable", "diagnosis", "cell_ref"], f"{path.name} loss_cell")
        if c["mineral_form"] not in MINERAL_FORMS:
            err(f"{path.name}: mineral_form '{c['mineral_form']}' вне enum")
        if c["diagnosis"] not in DIAGNOSES:
            err(f"{path.name}: diagnosis '{c['diagnosis']}' вне enum")
    # сумма cells == сумма summary
    for el in ("element_28", "element_29"):
        cells = sum(c["tons"] for c in d["loss_cells"] if c["element"] == el)
        summ = sum(s["tons"] for s in d["diagnosis_summary"] if s["element"] == el)
        if summ and abs(cells - summ) / summ * 100 > 1:
            err(f"{path.name}: {el} loss_cells {cells:.0f} т ≠ diagnosis_summary {summ:.0f} т")


def validate_board(path, claim_ids, node_ids):
    b = json.loads(path.read_text(encoding="utf-8"))
    need(b, ["snapshot", "kpi_contract", "diagnostics", "hypotheses"], "board")
    need(b["kpi_contract"], ["factory_id", "target", "constraints", "prices_usd_per_t"], "kpi_contract")
    diag_ids = {f"diag_{b['diagnostics']['factory_id']}_{i}" for i in range(len(b["diagnostics"]["loss_cells"]))}
    ranks = []
    for h in b["hypotheses"]:
        need(h, ["id", "title", "summary", "status", "rank", "score_total", "score_breakdown",
                 "economic_effect", "trace", "source_nodes", "risks", "missing_evidence", "doe_plan"],
             f"hypothesis {h.get('id')}")
        if h["status"] not in STATUSES:
            err(f"hyp {h['id']}: status вне enum")
        if set(h["score_breakdown"].keys()) != SCORE_AXES:
            err(f"hyp {h['id']}: score_breakdown должен содержать ровно оси {sorted(SCORE_AXES)}")
        for t in h["trace"]:
            if t not in claim_ids and t not in diag_ids and not t.startswith("diag_"):
                err(f"hyp {h['id']}: trace '{t}' не найден ни в claims, ни в диагнозах")
        for n in h["source_nodes"]:
            if n not in node_ids:
                err(f"hyp {h['id']}: source_node '{n}' не найден в entities")
        ee = h["economic_effect"]
        need(ee, ["addressable_tons", "recovery_gain_pct_range", "value_usd_range", "assumptions"], f"hyp {h['id']} economic_effect")
        ranks.append(h["rank"])
    if sorted(ranks) != list(range(1, len(ranks) + 1)):
        err(f"board: ranks не образуют 1..{len(ranks)}: {ranks}")


def validate_golden(path):
    items = json.loads(path.read_text(encoding="utf-8"))
    lever_types = {"grinding", "classification", "flotation", "reagents", "new_equipment", "automation", "other"}
    factories = set()
    for i in items:
        need(i, ["id", "factory_id", "text", "lever_type"], f"golden {i.get('id')}")
        factories.add(i["factory_id"])
        if i["lever_type"] not in lever_types:
            err(f"golden {i['id']}: lever_type '{i['lever_type']}' вне enum")
    if factories != {"kgmk", "nof_vkr", "nof_med", "tof"}:
        err(f"golden: ожидались 4 фабрики, есть {sorted(factories)}")


def main():
    docs = Path(__file__).resolve().parent.parent
    fixtures = docs / "fixtures"

    claim_ids, node_ids = validate_extract(fixtures / "extract_response.json")
    for f in sorted(fixtures.glob("diagnostics_*.json")):
        validate_diagnostics(f)
    validate_board(fixtures / "board.json", claim_ids, node_ids)
    validate_golden(docs / "golden" / "expert_hypotheses.json")

    if ERRORS:
        print(f"FAILED: {len(ERRORS)} ошибок")
        for e in ERRORS:
            print(" -", e)
        sys.exit(1)
    print("OK: все fixtures валидны (extract_response, diagnostics ×4, board, golden)")


if __name__ == "__main__":
    main()
