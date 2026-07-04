> ⚠️ Бэклог написан до пивота на флотационный кейс: имена данных сменились (flotation-v1, diagnostics, factories). Актуальные задачи — docs/prompt_*.md + docs/FINAL_SPRINT.md.

# P0 — Foundational Sprint

> **Авторитетный источник задач MVP — `TASKS.md` и role-specific файлы `*_tasks.md`.**
> Файлы P0/P1 — детальный бэклог для Rust-разработчика (Роль 1).
> При конфликте формулировок `TASKS.md` побеждает.

## Актуальная раздача ролей

- Роль 1 — Rust Track: `task-001`, `task-002`, `task-003`.
- Роль 2 — Python Agent: `task-004`.
- Роль 3 — Frontend: `task-005`.
- Роль 4 — Demo/Data/QA: fixtures, pack, sample docs, demo acceptance.

## Зависимости (DAG)

```
task-001 (contracts + fixtures)   ← ВСЕ ждут этого
       │
       ├── task-002 (engine-skeleton)   ← Роль 1, стартует сразу после 001
       │
       ├── task-003 (platform-axum)     ← Роль 1, стартует сразу после 001
       │
       ├── task-004 (sidecar-extract)   ← Роль 2, стартует сразу после 001
       │
       └── task-005 (web-board)         ← Роль 3, стартует сразу после 001
```

**task-001 блокирует всё.** Час ноль — вся команда вместе фиксирует контракты.
После мержа task-001 tasks 002–005 идут **параллельно**.

## Когда P0 завершён

Все 5 задач смёржены → можно запустить `just dev` и увидеть:
- Фронт рендерит доску из `fixtures/board.json`
- `GET /board` (platform) отдаёт ту же фикстуру
- Engine принимает граф из фикстуры и возвращает `Portfolio`
- Sidecar отвечает на `POST /extract` с мок-LLM

После этого стартует P1.
