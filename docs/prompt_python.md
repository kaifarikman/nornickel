# prompt_python.md — ночной бриф: Роль 2 (Python Agent / sidecar)

Ты работаешь в проекте «Фабрика гипотез» (хакатон Норникель, кейс: флотация Cu-Ni руд,
снижение потерь металлов с хвостами). Твоя зона: `sidecar/` — FastAPI-сервис, порт 8765.
Дедлайн сдачи проекта: 4 июля 23:59.

## Контекст кейса за 5 строк
Данные кейса — в `norn-hack/`: 4 фабрики, по каждой xlsx «Хвосты» (потери Ni/Cu по классам
крупности × минералогии) + PDF-учебники по флотации. Твой сервис — два входных агента:
детерминированный диагност xlsx (`/diagnose`, БЕЗ LLM) и RAG-экстрактор литературы
(`/extract`, LLM под pydantic-валидатором). Оба отдают строгий JSON и ничего не решают.
«Элемент 28/29» — анонимизированные металлы, в коде НЕ раскрывать.

## Что прочитать сначала (по порядку)
1. `CONTRACTS.md` — все структуры: `DiagnoseRequest`, `DiagnosticsReport`, `ExtractRequest`,
   `ExtractResponse`, `Claim`, форматы ошибок.
2. `FINAL_SPRINT.md` — общий план (твоя секция «Роль 2»).
3. `AGENT_RULES.md` — законы (не PyO3, LLM не ранжирует, только JSON).
4. **`docs/scripts/gen_diagnostics.py` — ГОТОВЫЙ работающий парсер xlsx, проверен на 4/4
   фабриках.** Не переписывай его — импортируй/оберни.
5. Данные: `norn-hack/Пример N/Хвосты*.xlsx`, `packs/flotation-v1.yaml` (секция
   `diagnosis_config` и `synonyms`), эталоны ответов — `fixtures/diagnostics_kgmk.json`,
   `fixtures/extract_response.json`.

## P0 задачи (строго по порядку)
1. **FastAPI-каркас**: `sidecar/`, порт 8765, `GET /health` → `{"status": "ok"}`.
   Pydantic-модели всех структур из CONTRACTS.md.
2. **`POST /diagnose`** — обернуть `parse_tails()` из `docs/scripts/gen_diagnostics.py`
   (перенеси модуль в `sidecar/`, добавь чтение `diagnosis_config` из
   `packs/flotation-v1.yaml` вместо констант в скрипте — правила диагнозов должны жить
   в pack). Вход `DiagnoseRequest`, выход `DiagnosticsReport`. Ошибки: файл не найден /
   якоря не найдены → 422 `XLSX_PARSE_ERROR` с понятным сообщением.
   **Приёмка №1: прогон на всех 4 xlsx из norn-hack без падений, суммы бьются
   (сравни с `fixtures/diagnostics_*.json` — это эталонный выход).**
3. **`POST /extract` (mock-режим)** — возвращает `fixtures/extract_response.json`.
   Это дефолт для демо: стабильно, без ключей, воспроизводимо.
4. **Парсер txt** (абзацы → кандидаты в claims) на `sample_docs/flotation/*.txt` —
   для проверки пайплайна без LLM.
5. **LLM-extraction за флагом `SIDECAR_LLM_ENABLED=true`**: PDF → текст (pypdf) →
   чанки с номерами страниц → LLM-промпт «извлеки claims о причинно-следственных связях
   в обогащении: рычаг → механизм → эффект, с полярностью» → pydantic-валидация →
   `source_page` ОБЯЗАТЕЛЕН для PDF. Прогони ОДИН раз по учебникам из
   `norn-hack/Дополнительные материалы/` + открытым статьям из `sample_docs/open/`,
   результат сохрани в `fixtures/extract_response_full.json` (демо поедет на нём как
   на mock — ключи на демо не жжём).
6. **Entity Resolver**: нормализация терминов по `synonyms` из pack (rules + fuzzy через
   difflib/rapidfuzz). «гидроциклон/циклон/ГЦ-660» → `hydrocyclone`.
7. **Вектор-индекс** (sentence-transformers или API-эмбеддинги, chunks с page):
   фундамент для novelty. `POST /embed` по контракту.

## P1 (только если P0 полностью готов)
- `POST /novelty` {hypothesis_text} → {novelty_score, similar:[{doc, page, score}]} —
  косинусная близость к корпусу. Фронт покажет «похожих работ не найдено (N чанков)».
- Vision-LLM по PNG-схемам из `norn-hack/Схемы флотации/` → черновики factories/*.yaml.

## Правила
- Только JSON на выходе. Никаких `rank`, `score_total`, `status` — это Rust.
- `/diagnose` — строго детерминированный, ноль LLM.
- LLM недоступна → всё демо работает на mock (`fixtures/*.json`).
- Невалидный вход → структурированная ошибка из CONTRACTS.md, не голый 500.

## Самопроверка (Done)
- `curl -X POST :8765/diagnose` для всех 4 фабрик → 200, суммы совпадают с
  `fixtures/diagnostics_*.json` (допуск 0.1%).
- Битый xlsx (подсунь пустой файл) → 422 с `XLSX_PARSE_ERROR`, не traceback.
- `POST /extract` (mock) → байт-в-байт `fixtures/extract_response.json`.
- `python3 docs/scripts/validate_fixtures.py` зелёный после генерации
  `extract_response_full.json` (проверь его тем же валидатором).

## НЕ делать (вырезано из спринта)
FAISS/Qdrant/Chroma (numpy + косинус хватит), skeptic/narrate эндпоинты, оркестрация
пайплайна (Rust дирижирует), прямое общение с фронтом, docker.
