# Task A — офлайн-скрипт чанкованного LLM-извлечения по корпусу

## Проблема

`extract_with_llm` (`agent-system/app/pipeline/extract/service.py`) делает ОДИН
LLM-вызов на весь вход — учебник PDF туда не влезает. Поэтому live-граф знаний
сейчас строится из пары txt-заметок, а «извлечение из литературы» фактически не
реализовано. Нужен офлайн-скрипт: корпус → чанки → батчи → N LLM-вызовов →
мердж → один валидный `ExtractResponse`.

## Что сделать

Новый файл `agent-system/app/scripts/extract_corpus.py` (CLI, запускается как
`cd agent-system && python3 -m app.scripts.extract_corpus [путь_к_конфигу]`).

1. **Вход** — конфиг как `docs/extract_corpus.json` (уже существует, формат:
   `{"pack_id": "...", "docs": [{"path": "...", "mime": "..."}]}`; `mime`
   опционален — выводить из расширения). Добавить в схему конфига опциональное
   поле `pages: "1-40"` у документа — фильтр диапазона страниц для PDF
   (фильтровать по `chunk.page` после парсинга).
2. **Чанки** — через существующий `parse_documents`
   (`app/pipeline/extract/documents.py`, умеет txt/pdf/docx).
3. **Батчи** — жадно набирать чанки до ~8000 символов текста на батч; один
   LLM-вызов на батч. Переиспользовать `SYSTEM_PROMPT`,
   `_parse_llm_extract_content`, `build_llm_client` из
   `app/pipeline/extract/service.py` — импортом, не копипастой.
4. **Ключ**: если LLM не сконфигурирован (`LlmNotConfiguredError`) — упасть
   сразу, до первого вызова, с сообщением `set OPENAI_API_KEY in agent-system/.env`.
5. **Мердж батчей**: перенумеровать id (`claim_001..`, `edge_001..`) сквозной
   нумерацией, чтобы не было коллизий; entity-id оставить как есть (после
   `normalize_extract_response` одинаковые сущности сольются — там есть
   `_merge_nodes`). Рёбра с битыми ссылками (src/dst/source_claims на
   несуществующие id) — отбрасывать с warning в stderr, не падать.
6. **Финал**: собрать один `ExtractResponse`, прогнать
   `normalize_extract_response` → `validate_extract_response`; статистика в
   stdout (документов/чанков/батчей/claims/entities/edges, сколько рёбер
   отброшено); записать `docs/fixtures/extract_response_v2.json`
   (`ensure_ascii=False`, `indent=2`). ОСНОВНУЮ фикстуру
   `extract_response.json` НЕ перезаписывать — это Task B после ревью.
7. Retry: одна повторная попытка на батч при невалидном JSON от LLM (вторая
   ошибка — пропустить батч с warning, продолжить).

## Приёмка

- `python3 -m app.scripts.extract_corpus` без ключа → понятная ошибка, exit 1.
- С ключом на дефолтном конфиге (методичка docx + 2 txt) → валидный
  `extract_response_v2.json`, статистика напечатана.
- `ruff check app tests`, `python3 -m compileall -q app`, `pytest -q tests` — зелёные.
- Юнит-тест на мердж (без LLM): два фейковых батч-payload'а с пересекающимися
  id → после мерджа id уникальны, битое ребро отброшено
  (`tests/test_extract_corpus_merge.py`).

## Не делать

- Не менять `/extract`-эндпоинт и `extract_with_llm`.
- Не добавлять зависимостей в pyproject.
- Не коммитить `extract_response_v2.json`, если прогон был на неполном корпусе.
