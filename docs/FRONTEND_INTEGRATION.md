# FRONTEND_INTEGRATION.md — таски фронта: связка с будущим backend

Бриф для агента Frontend-разработчика. Контекст: фронт в `frontend/` отревьюен —
качество высокое (89/89 тестов, все экраны, contracts.ts актуален), базовая работа
принята. Эти таски — ТОЛЬКО интеграционный шов с backend, который сейчас мигрирует
по `docs/BACKEND_MIGRATION.md`. Всё пишется автономно: бэк не нужен ни для одной
задачи — его имитирует MSW-мок (задача 2).

Прочитать: `docs/CONTRACTS.md`, секция **«HTTP-шов web ↔ platform»** — она
зафиксирована ПОСЛЕ появления твоего кода и местами отличается от того, что
сейчас в `src/api.ts`. Шов — закон для обоих краёв; бэк получил зеркальные задачи.

## Что уже правильно — не трогать

- `ApiClient` интерфейс, фикстурный клиент, паттерн fallback-на-фикстуры с
  `console.warn` — это демо-страховка, сохранить.
- `ensureRun`/кэш run_id per factory, `resetRun` через новый /run — совпадает со швом.
- Формулы локального rerun в `lib/rerun.ts` — эталон приёмки (задача 5).

## Задачи (по порядку)

### 1. Привести http-клиент к зафиксированному шву (`src/api.ts`)
Расхождения с CONTRACTS.md:
- `POST /run` body: сейчас `{ factory }` → должно быть
  `{ factory_id, pack_id: "flotation-v1" }` (kpi_contract опционален, пока не шлём).
- `POST /rerun` body: `{ run_id, action }` — у тебя уже так. Оставить.
- Ответ `/run` `{ run_id, board }` — у тебя уже так. Оставить.
- База URL: заменить `VITE_API_URL` на относительный `/api` по умолчанию
  (`const API_BASE = import.meta.env.VITE_API_URL ?? '/api'`). Прямой origin
  в env остаётся возможным для нестандартных запусков.

### 2. MSW-мок backend по шву — автономная разработка http-пути
Добавить `msw` (dev-dep) + `src/mocks/server.ts`: обработчики ВСЕХ эндпоинтов шва
(`/api/run`, `/api/board`, `/api/rerun`, `/api/hypothesis/:id`, `/api/extract`,
`/api/expert_hypotheses`, `/api/export/board.{json,csv}`), отвечающие данными из
`src/mocks/fixtures/*` и локальным `applyRerun`. Это «будущий бэк» до его готовности:
- в тестах — поднимать msw-сервер для всего блока «http api client» (сейчас он
  тестируется точечными стабами fetch — заменить);
- в dev — опциональный режим `VITE_API_MODE=msw` для ручной проверки http-пути UI.
Когда реальный бэк поднимется, он обязан пройти ТЕ ЖЕ тесты — см. задачу 5.

### 3. Один origin: proxy вместо CORS
- `vite.config.ts` → `server.proxy: { '/api': { target: 'http://127.0.0.1:8080', rewrite: p => p.replace(/^\/api/, '') } }`.
- `nginx.conf` → `location /api/ { proxy_pass http://backend:8080/; }` (имя
  сервиса — по docker-compose; добавить backend-сервис в compose закомментированным,
  пока его образа нет). CSP `connect-src 'self'` остаётся как есть — в этом и смысл.

### 4. Экспорт через бэк с локальным fallback
В `ReportExport`: сначала `GET /api/export/board.csv` (скачивание as-is);
ошибка/недоступен → текущая локальная генерация из board (оставить, пометить
в UI бейджем «generated locally», чтобы на демо не путаться, чей файл).

### 5. Контракт-тест «фикстура == бэк» (приёмка Интеграции I)
Скрипт `scripts/verify-parity.mjs` (запускается руками при живом бэке):
1) `POST /api/run {factory_id: "kgmk"}` → сверить структуру board zod/assert'ами
   и топ-гипотезу с `mocks/fixtures/board.json` (id, порядок величин value);
2) `POST /api/rerun {change_price ×2}` → `value_usd_range` всех гипотез ×2
   (допуск 1e-6), `snapshot.hash` не изменился;
3) сверить результат того же change_price через локальный `applyRerun` — расхождение
   чисел = бага одного из краёв, падать с diff-выводом.
Это единственная задача, где нужен живой бэк; всё остальное — до него.

### 6. Мелочи из ревью
- `scripts/sync-fixtures.mjs`: добавить `['fixtures/diagnostics_kgmk.json', 'diagnostics_kgmk.json']`
  и использовать его в `DIAGNOSTICS` вместо `initialBoard.diagnostics` (иначе
  перегенерация диагностики QA не доедет до фронта, пока не пересобран board.json).
- `README.md`: явно «тесты только на Node 22 (engines); на Node 23+ встроенный
  localStorage ломает jsdom — 89 ложных падений».
- `GET /api/hypothesis/:id` — сейчас деталка берёт гипотезу из board; добавить
  http-путь с fallback на board (роут в шве есть, используем для deep-link).

## Что НЕ делать
CORS-хаки на фронте, дублирование типов (только `contracts.ts`), переписывание
фикстурного клиента, новые экраны, полировка стилей до Интеграции II.

## Done
- [ ] Все тесты зелёные на Node 22, http-блок работает через msw (без стабов fetch).
- [ ] `pnpm dev` + фикстурный режим — полный флоу как раньше (регресса нет).
- [ ] `pnpm dev` + `VITE_API_MODE=msw` — тот же флоу через http-клиент.
- [ ] `verify-parity.mjs` готов и падает с внятным diff при расхождении формул.
- [ ] sync:fixtures тянет все 4 diagnostics + board + golden.
