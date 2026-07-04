from __future__ import annotations

from app.config import Settings, get_settings
from app.schemas import SkepticRequest, SkepticResponse
from app.infra.llm import build_llm_client

SYSTEM_PROMPT = """\
Ты технический скептик для портфеля проверяемых гипотез по обогащению руд.
Верни только JSON по заданной Pydantic-схеме.

Задача:
- указать главное возражение к гипотезе;
- перечислить недостающие доказательства;
- перечислить технологические/операционные риски;
- предложить короткие проверки или DOE-шаги.

Правила:
- Не меняй status, rank, score_total и score_breakdown.
- Не принимай решение за deterministic engine.
- Не добавляй финансовые оценки.
- Не выдумывай source ids, claim ids или страницы.
- Если в гипотезе уже есть risks/missing_evidence, учитывай их, но не копируй механически.
- Пиши коротко и предметно.
"""


def run_skeptic(request: SkepticRequest, settings: Settings | None = None) -> SkepticResponse:
    settings = settings or get_settings()
    if not settings.sidecar_llm_enabled:
        return _mock_skeptic(request)
    client = build_llm_client(settings)
    response = client.beta.chat.completions.parse(
        model=settings.active_fast_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": request.model_dump_json()},
        ],
        temperature=0,
        response_format=SkepticResponse,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None:
        raise ValueError("LLM skeptic parse returned empty parsed payload")
    return parsed


def _mock_skeptic(request: SkepticRequest) -> SkepticResponse:
    """Deterministic, offline skeptic block for demo mode (no LLM, no invented refs)."""
    return SkepticResponse(
        objection=(
            "Механизм правдоподобен, но перенос литературных условий на конкретный "
            "передел не доказан без пилотной проверки на реальном сырье."
        ),
        missing_evidence=[
            "Прямых измерений на данном сырье в источниках не приведено.",
            "Диапазон прироста извлечения взят из литературы и требует подтверждения на пилоте.",
        ],
        risks=[
            "Операционные ограничения фабрики могут снизить фактический эффект.",
            "Возможны побочные эффекты на смежных переделах.",
        ],
        suggested_checks=[
            "Лабораторная проверка на репрезентативной пробе хвостов.",
            "Пилотный DOE с контролем ключевого фактора и слепым сравнением.",
        ],
    )
