# Task B — прогон реального корпуса и фиксация фикстур (после Task A)

Требует: Task A смержен, `agent-system/.env` с рабочим `OPENAI_API_KEY`.

## Цель

Демо и live-режим должны ехать на claims из НАСТОЯЩЕЙ литературы кейса
(методичка + главы учебников), а не на 20 рукописных клеймах.

## Шаги

1. Расширить `docs/extract_corpus.json`: методичка
   `norn-hack/Как читать отчет института по хвостам.docx` + 30–50 самых
   релевантных страниц из 1–2 PDF-учебников кейса
   (`norn-hack/Дополнительные материалы/geokniga-flotacionnye-metody-obogashcheniya_0.pdf` —
   главы про классификацию/гидроциклоны/измельчение/кинетику флотации; диапазон
   выбрать по оглавлению через `python3 -c "import fitz; ..."`), поле `pages`.
2. Прогнать `python3 -m app.scripts.extract_corpus` → ревью
   `extract_response_v2.json` глазами: claims осмысленные, source_page настоящие,
   рычаги имеют `lever_type`/`capex_class`/`equipment_required` в properties
   (если LLM их не проставил — допроставить постпроцессингом по
   `packs/flotation-v1.yaml synonyms`, НЕ руками в json).
3. **Каскад замены фикстуры** (только если v2 качественный, иначе остановиться
   и оставить v2 как корпус для live):
   a. `docs/fixtures/extract_response.json` ← v2.
   b. Перегенерировать `docs/fixtures/board.json`:
      `python3 docs/scripts/gen_board_fixture.py`. ВНИМАНИЕ: в генераторе
      захардкожены trace_claims (`claim_001` и т.п.) и node-id — обновить их
      маппинг под новые id из v2; сохранить в board.json `expert_match`
      (правило: lever_type + diagnosis_hint против
      `docs/golden/expert_hypotheses.json`) и `diagnostics.diag_refs` +
      diag-шаги в trace (см. текущий board.json как образец структуры).
   c. `python3 docs/scripts/validate_fixtures.py` — OK.
   d. `cd frontend && node scripts/sync-fixtures.mjs && NODE_OPTIONS=--no-experimental-webstorage pnpm test`
      — тесты, завязанные на строки фикстуры (`tests/components/ForceGraph.test.tsx`,
      `tests/mocks/integrity.test.ts`, `tests/lib/trace.test.ts`), поправить под
      новые данные (ассерты по структуре, не по конкретным строкам, где возможно).
   e. `cd backend && UPDATE_GOLDEN=1 cargo test -p engine golden_board_flotation_v1
      && cargo test --workspace` — диф golden проверить глазами: только
      данные/тексты, скоринг-структура не должна деградировать (в топе всё ещё
      гипотезы про доизмельчение/классификацию — сверка с golden expert set).
   f. Живой смоук: `docker compose up --build -d` (без .env) → `make smoke` →
      `POST /run kgmk` → benchmark coverage НЕ упал (было 5/5 у КГМК; если
      новые claims сломали пути до диагнозов — вернуть шаг a назад и разобраться).

## Приёмка

- `/run kgmk` детерминирован (два запуска — одинаковый hash), top-гипотезы
  осмысленные, у claims настоящие страницы учебника.
- benchmark КГМК ≥ 4/5; все тесты трёх стеков зелёные.
- В карточке гипотезы во фронте цитаты — из настоящей литературы.

## Не делать

- Не коммитить .env / ключи.
- Не менять правила скоринга/пороги в engine ради «красивого» борда — только
  данные (fixtures, pack, corpus config).
