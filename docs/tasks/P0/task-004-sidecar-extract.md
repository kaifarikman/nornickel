> ⚠️ Бэклог написан до пивота на флотационный кейс: имена данных сменились (flotation-v1, diagnostics, factories). Актуальные задачи — docs/prompt_*.md + docs/FINAL_SPRINT.md.

# P0 · task-004 · /extract в сайдкаре  (Роль 2)
**Цель:** из документов получить claims по схеме.

**Сделать:**
- FastAPI `POST /extract` с `ExtractRequest` (см. `python_tasks.md` → входная схема).
- Mock-режим: если `SIDECAR_LLM_ENABLED` не установлен, возвращать `fixtures/extract_response.json` напрямую.
- Парсер `.txt` (абзацы) и `.csv` (pandas, строки → experiment claims). PDF — P1.
- Базовый Entity Resolver: нормализация через словарь из `packs/alloys-v1.yaml`.
- Ошибки в формате `{ "error": { "code", "message", "details" } }` (см. `API_CONVENTIONS.md`).

**Done:** `POST /extract` на `sample_docs/aging_2618a.txt` и `sample_docs/internal_experiments.csv` возвращает валидный `ExtractResponse`; невалидный файл даёт понятную ошибку.
