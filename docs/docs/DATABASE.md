# DATABASE.md — sqlite (crates/platform)

## Таблицы
- **claim**(id, text, source_ref, confidence, payload_json) — извлечённый факт.
- **entity**(id, kind, label, tags_json) — узел графа; `tags` включает `controllable`/`kpi`.
- **edge**(id, src, dst, edge_type, mechanism, source_ref) — ребро `фактор→...→KPI`.
- **snapshot**(id, hash, doc_count, created_at) — замороженное состояние графа.
- **hypothesis**(id, snapshot_id, status, score_json, trace_json, doe_json) — результат run.
- **run**(id, snapshot_id, kpi_contract_json, pack_id, created_at).
- **doc**(id, path, mime, hash) — учёт исходников.

## Связи
edge.src/dst → entity.id · hypothesis.snapshot_id → snapshot.id ·
run.snapshot_id → snapshot.id · claim.source_ref → doc.id.

## Инварианты
- snapshot.hash = детерминированный хэш (entity+edge) на момент заморозки.
- run воспроизводим: (snapshot_id, kpi_contract, pack_id) → те же hypothesis.
- Новый feedback не переписывает старый run — порождает новый snapshot + run.

## Вектор-индекс (владелец — sidecar)

Хранится **в памяти сайдкара** как FAISS-индекс (или `numpy` массив на этапе хакатона).
Не персистируется между перезапусками — восстанавливается при повторном `/embed`.

Структура записи: `{chunk_id: str, vector: [f32], source_ref: doc.id, text_snippet: str}`

Используется только в `POST /embed` → `/skeptic` для поиска ближайших кусков-доказательств.
Если нужна персистентность — файл `data/vectors.faiss` рядом с `data/app.db`.

Роль 2 владеет индексом полностью. Platform и engine никогда не трогают вектора напрямую.
