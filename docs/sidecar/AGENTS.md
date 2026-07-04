# sidecar — Python агент (Роль 2)  [волатильный слой]
Отдаёт ТОЛЬКО JSON, ничего не решает. LLM = extract/skeptic/narrate, не ранжирование.
- Эндпоинты: /extract /embed /skeptic /narrate (docs/API_CONVENTIONS.md).
- Извлечение под pydantic-валидатором; нормализация единиц по pack.
- Это первый кандидат на переписывание при пивоте — держать тонким и заменяемым.
