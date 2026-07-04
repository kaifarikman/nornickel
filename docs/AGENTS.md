# AGENTS.md — Фабрика гипотез

Корневые правила для любого агента/разработчика в этом репозитории.
Этот файл — **источник правды**. Корневой `CLAUDE.md` = одна строка `См. AGENTS.md`.

## Что это
R&D Decision Platform: из локального корпуса (PDF/DOCX/CSV) строим объяснимый,
воспроизводимый, ранжированный портфель проверяемых гипотез. Подробно — PROJECT_CONTEXT.md.

## ГЛАВНЫЙ ЗАКОН — граница волатильности
- **Rust** = стабильное детерминированное ядро + платформа. Работает над **generic-графом**.
- **Python** = волатильный агент-сайдкар (LLM, парсинг, эмбеддинги, оркестрация pipeline).
- **TS/React** = фронт.
- Вся доменная семантика (что такое материал/свойство/KPI, единицы, правила) живёт в
  **domain pack** как ДАННЫЕ, а не в коде ядра. См. docs/DOMAIN_PACK.md.
- При смене задачи переписывается ТОЛЬКО Python-сайдкар + pack. Ядро не трогаем.

Нарушение закона — повод отклонить PR. Жёсткие правила — AGENT_RULES.md.

## Команды (полностью — docs/BUILD.md)
- Сборка: `just build`  ·  Дев: `just dev`  ·  Тесты: `just test`
- Линт (обязателен перед PR): `cargo clippy --workspace -- -D warnings`,
  `pnpm -C web lint`, `ruff check sidecar`

## Контракт (свято)
Граница Python↔Rust — **только JSON**, Rust валидирует на входе. **Без PyO3.**
Единый источник структур — `crates/contracts`; TS-типы генерятся из него. См. docs/API_CONVENTIONS.md.

## Definition of Done
Ни один PR не мёржится без DEFINITION_OF_DONE.md.

## Карта
AGENT_RULES.md · PROJECT_CONTEXT.md · ROLES.md · DEFINITION_OF_DONE.md
docs/{BUILD,TESTING,DATABASE,API_CONVENTIONS,DOMAIN_PACK,WORKED_EXAMPLE}.md
tasks/{P0,P1}/  ·  .claude/skills/
