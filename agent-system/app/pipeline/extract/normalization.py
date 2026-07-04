from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import yaml

from app.infra.paths import DOCS_DIR
from app.pipeline.extract.entities import EntityResolver
from app.schemas import ExtractResponse, GraphNode


@dataclass(frozen=True)
class NormalizedEntity:
    id: str
    label: str
    properties: dict[str, Any]


def normalize_extract_response(response: ExtractResponse) -> ExtractResponse:
    resolver = EntityResolver.from_pack(response.pack_id)
    diagnosis_by_alias = _diagnosis_aliases(response.pack_id)
    entity_context = _entity_context(response)
    id_map: dict[str, str] = {}
    normalized_nodes: dict[str, GraphNode] = {}

    for entity in response.entities:
        normalized = _normalize_entity(
            entity,
            resolver,
            diagnosis_by_alias,
            entity_context.get(entity.id, ""),
        )
        id_map[entity.id] = normalized.id
        node = entity.model_copy(
            update={
                "id": normalized.id,
                "label": normalized.label,
                "tags": _normalized_tags(entity, normalized),
                "properties": normalized.properties,
            },
            deep=True,
        )
        existing = normalized_nodes.get(node.id)
        normalized_nodes[node.id] = _merge_nodes(existing, node) if existing else node

    edges = [
        edge.model_copy(
            update={
                "src": id_map.get(edge.src, edge.src),
                "dst": id_map.get(edge.dst, edge.dst),
            },
            deep=True,
        )
        for edge in response.edges
    ]

    return response.model_copy(update={"entities": list(normalized_nodes.values()), "edges": edges}, deep=True)


def _normalize_entity(
    entity: GraphNode,
    resolver: EntityResolver,
    diagnosis_by_alias: dict[str, NormalizedEntity],
    context: str,
) -> NormalizedEntity:
    if entity.properties.get("canonical_source"):
        return NormalizedEntity(id=entity.id, label=entity.label, properties=dict(entity.properties))

    entity_text = _entity_text(entity)
    normalized_entity_text = _normalize_text(entity_text)
    properties = dict(entity.properties)

    diagnosis = _match_diagnosis(normalized_entity_text, diagnosis_by_alias)
    if diagnosis is not None:
        properties.update(diagnosis.properties)
        properties.setdefault("original_id", entity.id)
        properties["canonical_source"] = "pack.diagnosis_config"
        return NormalizedEntity(id=diagnosis.id, label=diagnosis.label, properties=properties)

    text = f"{entity_text} {context}".strip() if entity.kind == "factor" else entity_text
    matches = resolver.resolve_text(text)
    if matches:
        match = matches[0]
        canonical_id = f"node_{match.entity_id}"
        properties.setdefault("original_id", entity.id)
        properties["pack_entity_id"] = match.entity_id
        properties["pack_alias"] = match.alias
        properties["pack_match_score"] = round(match.score, 3)
        properties["canonical_source"] = "pack.synonyms"
        return NormalizedEntity(id=canonical_id, label=entity.label, properties=properties)

    properties.setdefault("normalization_warning", "unmatched_pack_entity")
    return NormalizedEntity(id=entity.id, label=entity.label, properties=properties)


def _entity_context(response: ExtractResponse) -> dict[str, str]:
    claim_text_by_id = {claim.id: claim.text for claim in response.claims}
    context: dict[str, list[str]] = {}
    for edge in response.edges:
        edge_context = [edge.mechanism]
        edge_context.extend(
            claim_text_by_id[claim_id]
            for claim_id in edge.source_claims
            if claim_id in claim_text_by_id
        )
        text = " ".join(edge_context)
        context.setdefault(edge.src, []).append(text)
        context.setdefault(edge.dst, []).append(text)
    return {entity_id: " ".join(parts) for entity_id, parts in context.items()}


def _merge_nodes(left: GraphNode | None, right: GraphNode) -> GraphNode:
    if left is None:
        return right

    tags = sorted(set(left.tags) | set(right.tags))
    properties = dict(left.properties)
    duplicate_ids = list(properties.get("merged_original_ids", []))
    for node in (left, right):
        original_id = node.properties.get("original_id")
        if isinstance(original_id, str) and original_id not in duplicate_ids:
            duplicate_ids.append(original_id)
    if duplicate_ids:
        properties["merged_original_ids"] = duplicate_ids
    for key, value in right.properties.items():
        properties.setdefault(key, value)

    label = left.label if len(left.label) >= len(right.label) else right.label
    kind = left.kind if left.kind == right.kind else left.kind
    return left.model_copy(update={"label": label, "kind": kind, "tags": tags, "properties": properties}, deep=True)


def _normalized_tags(entity: GraphNode, normalized: NormalizedEntity) -> list[str]:
    tags = set(entity.tags)
    if normalized.properties.get("canonical_source") == "pack.diagnosis_config":
        tags.add("diagnosis")
    if entity.kind == "factor":
        tags.add("controllable")
    if entity.kind == "kpi":
        tags.add("kpi")
    return sorted(tags)


def _diagnosis_aliases(pack_id: str) -> dict[str, NormalizedEntity]:
    pack_path = DOCS_DIR / "packs" / f"{pack_id}.yaml"
    data = yaml.safe_load(pack_path.read_text(encoding="utf-8"))
    rules = data.get("diagnosis_config", {}).get("rules", [])
    aliases: dict[str, NormalizedEntity] = {}
    for rule in rules:
        diagnosis = str(rule.get("diagnosis", "")).strip()
        if not diagnosis:
            continue
        label = str(rule.get("label") or diagnosis)
        normalized = NormalizedEntity(
            id=f"node_diag_{diagnosis}",
            label=f"потери: {label}",
            properties={"diagnosis": diagnosis},
        )
        for alias in {diagnosis, label, diagnosis.replace("_", " ")}:
            aliases[_normalize_text(alias)] = normalized
    aliases[_normalize_text("недораскрытие")] = NormalizedEntity(
        id="node_diag_liberation_deficit",
        label="потери: недораскрытие сростков",
        properties={"diagnosis": "liberation_deficit"},
    )
    aliases[_normalize_text("шламы")] = NormalizedEntity(
        id="node_diag_slimes_overgrinding",
        label="потери: переизмельчение/шламы",
        properties={"diagnosis": "slimes_overgrinding"},
    )
    aliases[_normalize_text("кинетика флотации")] = NormalizedEntity(
        id="node_diag_flotation_kinetics",
        label="потери: кинетика/режим флотации",
        properties={"diagnosis": "flotation_kinetics"},
    )
    return aliases


def _match_diagnosis(
    normalized_text: str,
    diagnosis_by_alias: dict[str, NormalizedEntity],
) -> NormalizedEntity | None:
    for alias, diagnosis in diagnosis_by_alias.items():
        if alias and alias in normalized_text:
            return diagnosis
    return None


def _entity_text(entity: GraphNode) -> str:
    parts = [entity.id, entity.label, entity.kind, " ".join(entity.tags)]
    for key, value in entity.properties.items():
        parts.append(str(key))
        parts.append(str(value))
    return " ".join(parts)


def _normalize_text(value: str) -> str:
    value = value.lower().replace("ё", "е")
    value = re.sub(r"\s+", " ", value)
    return value.strip()
