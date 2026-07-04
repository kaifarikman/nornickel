

from __future__ import annotations

import re
from dataclasses import dataclass

import yaml

from app.infra.paths import DOCS_DIR

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None


@dataclass(frozen=True)
class EntityMatch:
    entity_id: str
    alias: str
    score: float


@dataclass(frozen=True)
class EntityResolver:
    aliases: dict[str, list[str]]
    threshold: float = 88.0

    @classmethod
    def from_pack(cls, pack_id: str = "flotation-v1") -> EntityResolver:
        pack_path = DOCS_DIR / "packs" / f"{pack_id}.yaml"
        data = yaml.safe_load(pack_path.read_text(encoding="utf-8"))
        synonyms = data.get("synonyms", {})
        if not isinstance(synonyms, dict):
            synonyms = {}

        return cls(aliases={str(k): [str(v) for v in vals] for k, vals in synonyms.items()})

    def resolve_text(self, text: str) -> list[EntityMatch]:
        normalized_text = _normalize(text)
        matches: dict[str, EntityMatch] = {}

        for entity_id, aliases in self.aliases.items():
            for alias in aliases:
                normalized_alias = _normalize(alias)
                score = self._score(normalized_text, normalized_alias)
                if score < self.threshold:
                    continue
                current = matches.get(entity_id)
                if current is None or score > current.score:
                    matches[entity_id] = EntityMatch(entity_id=entity_id, alias=alias, score=score)

        return sorted(matches.values(), key=lambda m: (-m.score, m.entity_id))

    def _score(self, text: str, alias: str) -> float:
        if not alias:
            return 0.0

        if _contains_term(text, alias):
            return 100.0

        if fuzz is None:
            return 0.0

        return float(fuzz.partial_ratio(alias, text))


def _normalize(value: str) -> str:
    value = value.lower().replace("ё", "е")
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def _contains_term(text: str, alias: str) -> bool:
    if re.search(r"[a-zа-я0-9]", alias, flags=re.IGNORECASE) is None:
        return alias in text

    pattern = rf"(?<![\wа-яА-Я]){re.escape(alias)}(?![\wа-яА-Я])"

    if re.search(pattern, text, flags=re.IGNORECASE) is not None:
        return True

    alias_tokens = re.findall(r"[\wа-яА-Я]+", alias, flags=re.IGNORECASE)
    if not alias_tokens:
        return False

    text_tokens = re.findall(r"[\wа-яА-Я]+", text, flags=re.IGNORECASE)

    for alias_token in alias_tokens:
        if len(alias_token) < 6:
            return False

        if not any(token.startswith(alias_token) for token in text_tokens):
            return False

    return True
