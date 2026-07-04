from __future__ import annotations

from app.config import Settings, get_settings
from app.infra.llm import build_yandex_client
from app.schemas import NarrateRequest, NarrateResponse

SYSTEM_PROMPT = """\
Ты пишешь объяснение для карточки гипотезы в системе «Фабрика гипотез».
Верни только JSON по заданной Pydantic-схеме.

Задача:
- кратко объяснить, почему гипотеза появилась;
- связать механизм, trace/source_nodes, экономический эффект, риски и DOE-проверку;
- если переданы skeptic или novelty, встроить их как осторожный контекст.

Правила:
- Не меняй status, rank, score_total, score_breakdown и economic_effect.
- Не добавляй новые claim ids, source ids, страницы или числа.
- Не делай финального решения за deterministic engine.
- Не обещай эффект как факт: формулируй как проверяемую гипотезу.
- Текст должен быть пригоден для карточки: 1-3 абзаца, без markdown.
"""


def run_narrate(request: NarrateRequest, settings: Settings | None = None) -> NarrateResponse:
    settings = settings or get_settings()
    if not settings.sidecar_llm_enabled:
        return _mock_narrate(request)
    client = build_yandex_client(settings)
    response = client.beta.chat.completions.parse(
        model=settings.fast_model_uri,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": request.model_dump_json()},
        ],
        temperature=0,
        response_format=NarrateResponse,
    )
    parsed = response.choices[0].message.parsed
    if parsed is None:
        raise ValueError("Yandex narrate parse returned empty parsed payload")
    return parsed


def _mock_narrate(request: NarrateRequest) -> NarrateResponse:
    """Deterministic, offline narrative for demo mode (no LLM, no invented numbers)."""
    hypothesis = request.hypothesis
    title = hypothesis.get("title") or hypothesis.get("label") or hypothesis.get("id") or "гипотеза"
    mechanism = hypothesis.get("mechanism")

    sentences = [
        f"Гипотеза «{title}» предложена детерминированным движком по цепочке "
        "диагноз потерь → механизм из литературы → доступный на фабрике рычаг.",
    ]
    if mechanism:
        sentences.append(f"Предполагаемый механизм: {mechanism}.")
    sentences.append(
        "Это проверяемое предположение, а не подтверждённый результат: приоритет и "
        "экономический эффект посчитаны движком, фактический прирост извлечения "
        "подлежит проверке по плану DOE."
    )
    return NarrateResponse(text=" ".join(sentences))
