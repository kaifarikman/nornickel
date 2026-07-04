> ⚠️ Бэклог написан до пивота на флотационный кейс: имена данных сменились (flotation-v1, diagnostics, factories). Актуальные задачи — docs/prompt_*.md + docs/FINAL_SPRINT.md.

# P0 · task-003 · axum отдаёт фикстуру  (Роль 1)
**Цель:** фронт и engine цепляются параллельно.
**Сделать:** axum с `GET /board?run_id=` → отдаёт `fixtures/board.json`; CORS для vite; заглушки `/ingest`,`/run`,`/rerun`.
**Done:** `curl :8080/board` отдаёт валидный BoardResponse.
