# AGENT_SYSTEM_FIXES.md — фиксы Python-сайдкара по ревью

Бриф для агента Python-разработчика. Контекст: `agent-system/` отревьюен против
`docs/CONTRACTS.md` — **работа сильная и принята**: parse_tails взят дословно,
mock/live за флагом, схемы совпадают, Entity Resolver по pack.synonyms, порт 8765,
без тяжёлых зависимостей, артефакт-трейл — отличный бонус для питча про
воспроизводимость. Ниже — точечные фиксы. Оценка: 2–4 часа.

Прочитать: `docs/CONTRACTS.md` (секции DiagnosticsReport, формат ошибок),
`docs/prompt_python.md` (исходный бриф), `docs/FINAL_SPRINT.md` (демо-сценарий).

## Главный принцип, который сейчас нарушен

**Демо-страховка**: `/diagnose` и mock-`/extract` обязаны работать на чистой машине —
без `.env`, без сети, без Postgres. Если LLM/БД недоступны, демо едет на mock.
Сейчас сервис в таком окружении даже не стартует.

---

## Критические (сегодня)

### 1. `app/config/settings.py` — старт без .env
`YANDEX_API_KEY`, `YANDEX_FOLDER_ID`, `YANDEX_MODEL_*` объявлены обязательными →
без `.env` приложение падает на импорте settings, хотя mock-путь ключи не использует.
Фикс:
- всем yandex-полям дефолт `""`;
- в `extract_with_yandex` (и только там) — явная проверка: пустой ключ при
  `SIDECAR_LLM_ENABLED=true` → понятная ошибка 422 `LLM_NOT_CONFIGURED`
  (mock-режим при этом продолжает работать);
- добавить `.env.example` с плейсхолдерами и строкой `SIDECAR_LLM_ENABLED=false`.

### 2. Postgres — лениво, только для live-пути
`DATABASE_URL` должен требоваться только когда реально дергается db-слой
(live extract / embed / retrieve). Проверить: `uvicorn app.api.main:app` на машине
без PG и без DATABASE_URL стартует, `/health`, `/diagnose`, mock-`/extract` работают.
Если сейчас соединение создаётся на старте — сделать lazy (создание при первом
обращении + 422 `DB_NOT_CONFIGURED` из live-эндпоинтов).

### 3. `CHECKSUM_MISMATCH` 422 при расхождении > 5% (CONTRACTS.md, формат ошибок)
Сейчас парсер пишет `checksum_mismatch` в `data_quality` (порог 1%), но код
`CHECKSUM_MISMATCH`/422 не поднимается никогда — Rust-край его ждёт по контракту.
Фикс в `app/pipeline/diagnose/service.py`: после parse_tails — если
`max(delta_pct) > 5.0` → ошибка 422 `CHECKSUM_MISMATCH` с details
(location, delta_pct). Диапазон 1–5% остаётся мягким репортом в data_quality.

### 4. Пути к xlsx в докере
`compose.yaml` монтирует только `.:/app/agent-system` → внутри контейнера
`REPO_ROOT` резолвится в несуществующую точку, `/diagnose` не найдёт
`norn-hack/Пример 1/…`. Фикс: смонтировать данные read-only
(`../norn-hack:/app/norn-hack:ro` + при необходимости `../docs:/app/docs:ro`)
и убедиться, что `paths.py` находит их из контейнера. В README добавить:
«для демо надёжнее локальный uvicorn — докер это доп. вариант».

## Средние (до Интеграции II)

### 5. `diagnosis_config` из pack, а не хардкод
`parser.py:33-48` держит SIZE_GROUPS / RECOVERABILITY / DIAGNOSIS_RULES константами.
Наш главный питч — «вся доменная семантика в pack, не в коде», и жюри может
попросить показать. Фикс: `parse_tails(path, factory_id, config)` — конфиг
загружает `service.py` из `packs/flotation-v1.yaml` (`diagnosis_config`), маппинг
yaml-правил в текущую структуру тривиален. Константы оставить как fallback-дефолт
при отсутствии секции в pack.

### 6. Коды ошибок точнее
- Битый JSON (RequestValidationError) → **400** `VALIDATION_ERROR`
  (сейчас 422; по CONTRACTS.md 422 — «валидный JSON, не прошёл бизнес-валидацию»).
- В `/diagnose` не заворачивать ЛЮБОЙ Exception в `XLSX_PARSE_ERROR` — этот код
  только для «файл не читается/якоря не найдены». Прочие исключения → честный 500
  (иначе на демо реальный баг замаскируется под «плохой файл»).

### 7. Удалить мёртвые файлы
`agent-system/Хвосты *.xlsx` (4 шт.) — код на них не ссылается, читает `norn-hack/`.
Дубли данных = риск рассинхрона. Удалить.

### 8. Пометить источник правды parse_tails
Теперь две копии парсера. Договорённость: **sidecar — источник правды**
(`app/pipeline/diagnose/parser.py`), а `docs/scripts/gen_diagnostics.py` — frozen
генератор фикстур. Добавить в docstring обоих файлов по строке об этом; при правках
парсера — переносить в docs/scripts и перегенерировать fixtures
(`python3 docs/scripts/gen_diagnostics.py` + `validate_fixtures.py`).

## Норма — НЕ менять (зафиксировано ревью)

- `StrictModel` (extra=forbid, strict) — ок как договорённость: Rust шлёт ровно
  контрактные поля. Держать в синхроне с CONTRACTS.md.
- Дополнительные роуты `/embed`, `/retrieve`, `/skeptic`, `/narrate` — P1-задел,
  Rust-интеграции не мешают.
- Артефакт-трейл (run_id, evidence, заголовки) — оставить, это козырь питча
  про воспроизводимость; Rust заголовки игнорирует.
- YandexGPT как LLM-провайдер — ок (доступность из РФ, OpenAI-совместимый API).

## Верификация (Done)

- [ ] Чистое окружение (без .env, без Postgres): `uvicorn app.api.main:app --port 8765`
  стартует; `GET /health` → ok.
- [ ] `POST /diagnose` для всех 4 фабрик → 200; суммы tons совпадают с
  `docs/fixtures/diagnostics_*.json` (допуск 0.1%) — быстрый скрипт сверки в tests.
- [ ] mock-`POST /extract` → байт-в-байт `fixtures/extract_response.json`.
- [ ] Пустой/битый файл → 422 `XLSX_PARSE_ERROR`; файл с расхождением >5%
  (подделать копию КГМК) → 422 `CHECKSUM_MISMATCH`; неожиданное исключение → 500.
- [ ] Правка `diagnosis_config` в pack (например, перенос «-45 +20» в coarse)
  меняет диагнозы ответа БЕЗ правки кода.
- [ ] `pytest` зелёный, включая новый тест «старт и mock-путь без env/БД».
