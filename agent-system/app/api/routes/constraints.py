from __future__ import annotations

import re

from fastapi import APIRouter
from rapidfuzz import fuzz

from app.schemas import ParseConstraintsRequest, ParseConstraintsResponse

router = APIRouter(tags=["constraints"])


@router.post("/parse_constraints", response_model=ParseConstraintsResponse)
def parse_constraints(request: ParseConstraintsRequest) -> ParseConstraintsResponse:
    actions: list[dict[str, object]] = []
    unparsed: list[str] = []
    text = request.text.strip()
    low = _normalize(text)

    price_action = _parse_price(low, request.kpi_contract)
    if price_action is not None:
        actions.append(price_action)

    if _mentions_capex_limit(low):
        actions.append({
            "kind": "add_constraint",
            "payload": {"metric": "capex_class", "op": "<=", "value": 1},
        })

    unmatched_excludes = _parse_exclusions(low, request)
    actions.extend(action for action, _term in unmatched_excludes if action is not None)
    unparsed.extend(term for action, term in unmatched_excludes if action is None)

    if not actions and not unparsed and text:
        unparsed.append(text)

    return ParseConstraintsResponse.model_validate({
        "actions": actions,
        "kpi_contract_patch": {},
        "unparsed": unparsed,
    })


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().replace("ё", "е")).strip()


def _element_from_text(text: str) -> str | None:
    if re.search(r"\b28\b|элемент\s*28|никел|nickel|\bni\b", text):
        return "element_28"
    if re.search(r"\b29\b|элемент\s*29|мед|copper|\bcu\b", text):
        return "element_29"
    return None


def _parse_number(text: str) -> float | None:
    matches = re.findall(r"\d[\d _]*", text)
    if not matches:
        return None
    raw = re.sub(r"[^\d]", "", matches[-1])
    return float(raw) if raw else None


def _parse_price(text: str, contract: dict[str, object]) -> dict[str, object] | None:
    if "цен" not in text and "вдвое" not in text:
        return None
    element = _element_from_text(text)
    if element is None:
        return None
    prices = contract.get("prices_usd_per_t")
    current = prices.get(element) if isinstance(prices, dict) else None
    if "вдвое" in text and isinstance(current, (int, float)):
        value = float(current) * 2
    else:
        value = _parse_number(text)
    if value is None:
        return None
    return {
        "kind": "change_price",
        "payload": {"element": element, "usd_per_t": value},
    }


def _mentions_capex_limit(text: str) -> bool:
    return any(
        pattern in text
        for pattern in (
            "без капзатрат",
            "капзатраты запрещ",
            "капекс запрещ",
            "без capex",
            "только настройки",
        )
    )


def _parse_exclusions(
    text: str,
    request: ParseConstraintsRequest,
) -> list[tuple[dict[str, object] | None, str]]:
    out: list[tuple[dict[str, object] | None, str]] = []
    for match in re.finditer(r"(?:исключи|исключить|не использовать|без)\s+([^,.]+)", text):
        term = match.group(1).strip()
        if not term or "кап" in term or "capex" in term:
            continue
        factor_id = _match_factor(term, request)
        if factor_id is None:
            out.append((None, term))
        else:
            out.append(({
                "kind": "exclude_factor",
                "payload": {"factor_id": factor_id},
            }, term))
    return out


def _match_factor(term: str, request: ParseConstraintsRequest) -> str | None:
    normalized = _normalize(term)
    best_id: str | None = None
    best_score = 0
    for factor in request.factors:
        haystack = _normalize(f"{factor.id} {factor.label}")
        score = 100 if normalized in haystack else fuzz.WRatio(normalized, haystack)
        if score > best_score:
            best_score = score
            best_id = factor.id
    return best_id if best_score >= 65 else None
