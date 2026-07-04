# Frontend — Фабрика гипотез (UI)

Демонстрационная витрина R&D-платформы «Фабрика гипотез»: объяснимый портфель
исследовательских гипотез с трассировкой до источников. Фронтенд работает от
фикстур/моков и не требует backend — это позволяет разрабатывать и демонстрировать
UI независимо от Rust-движка и Python-агента. Правила проекта —
[../docs/AGENTS.md](../docs/AGENTS.md).

Целевая поставка — десктоп-приложение на **Tauri** (нативный file dialog, скан
папки, спавн Python-сайдкара). Сейчас фронт запускается как веб (Vite в браузере);
переход на Tauri аддитивный — весь доступ к данным идёт через единый `ApiClient`
([src/api.ts](src/api.ts)), нативные вызовы прячутся за feature-detection
`window.__TAURI__`.

## Стек

- React 19 + TypeScript
- Vite 6
- react-router 7
- TanStack Query 5
- CSS Modules
- lucide-react (иконки)
- Vitest + Testing Library
- pnpm 11 (`packageManager` закреплён в `package.json`)

## Быстрый старт

Требуется Node 22 и pnpm 11 (`corepack enable`).

> **Тесты — только на Node 22** (закреплено в `engines`). На Node 23+ встроенный
> `localStorage` ломает jsdom — ложные падения всех тестов
> (`localStorage.clear is not a function`). Обход, если Node 22 нет под рукой:
> `NODE_OPTIONS=--no-experimental-webstorage pnpm test` — проверено на Node 25,
> 96/96 зелёные.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

### Режимы API

| Режим                    | Как включить                  | Что происходит                                        |
| ------------------------ | ----------------------------- | ----------------------------------------------------- |
| Фикстуры (по умолчанию)  | ничего                        | данные из `src/mocks/`, сеть не используется          |
| MSW-мок бэка             | `VITE_API_MODE=msw pnpm dev`  | http-клиент ходит на `/api`, отвечает MSW в браузере  |
| Реальный бэк через proxy | `VITE_API_MODE=http pnpm dev` | `/api` проксируется на `http://127.0.0.1:8080` (vite) |
| Прямой origin            | `VITE_API_URL=http://...`     | нестандартные запуски; см. `.env.example` и CSP       |

При любой ошибке http-пути клиент пишет `console.warn` и падает обратно на
фикстуры (демо-страховка).

### Docker

Compose живёт в корне монорепо (`../compose.yaml`), запускать оттуда:

```bash
docker compose up frontend      # прод-сборка под nginx на :80
```

Для dev-сервера с hot-reload — локальный `pnpm dev` (см. «Быстрый старт»), Docker не нужен.

nginx в `frontend` проксирует `/api/` на `http://backend:8080/` и резолвит имя лениво
(resolver + переменная в nginx.conf): контейнер стартует и без бэка — `/api`
отвечает 502, фронт уходит в fixture-fallback. Когда контейнер бэка появится,
достаточно подключить его в общую docker-сеть под именем `backend`.

`VITE_API_URL` / `VITE_API_MODE` — build-time env Vite, инлайнятся в бандл на
`pnpm build`; в Docker передавать как `--build-arg` (см. Dockerfile). Сборка
под реальный бэк за nginx-proxy: `docker build --build-arg VITE_API_MODE=http`.
Если бэк на другом origin (`VITE_API_URL`) — расширить `connect-src` в
nginx.conf, иначе браузер заблокирует fetch по CSP и фронт молча уйдёт в
fixture-fallback.

## Скрипты

| Команда              | Действие                                                 |
| -------------------- | -------------------------------------------------------- |
| `pnpm dev`           | Dev-сервер Vite                                          |
| `pnpm build`         | Проверка типов (`tsc -b`) + прод-сборка                  |
| `pnpm lint`          | ESLint                                                   |
| `pnpm format`        | Prettier (`--write`)                                     |
| `pnpm format:check`  | Prettier в режиме проверки                               |
| `pnpm test`          | Прогон тестов (Vitest)                                   |
| `pnpm test:watch`    | Тесты в watch-режиме                                     |
| `pnpm test:coverage` | Тесты с покрытием                                        |
| `pnpm sync:fixtures` | Синхронизировать фикстуры из `../docs` (единый источник) |
| `pnpm verify:parity` | Контракт-тест «фикстура == бэк» против живого backend    |
| `pnpm preview`       | Локальный предпросмотр прод-сборки                       |

`verify:parity` — единственный сценарий, где нужен живой бэк
(`pnpm verify:parity [http://127.0.0.1:8080]`): гоняет `/run` и `/rerun
change_price ×2`, сверяет структуру board, топ-гипотезу и числа с локальным
`applyRerun`; при расхождении падает с diff-выводом.

Pre-commit хук (husky + lint-staged) прогоняет `eslint --fix` и `prettier` по
застейдженным файлам.

## Структура

```text
src/
  api.ts          единый ApiClient (фикстуры + HTTP-клиент с валидацией ответов)
  contracts.ts    типы контрактов Rust/Python API
  app/            каркас: Layout, Sidebar, TopBar, роутер (lazy), фон
  features/       экраны: setup, run, diagnosis, hypotheses,
                  graph, benchmark, library, report
  components/     переиспользуемые UI-компоненты
  i18n/           словари ru/en и провайдер локали
  lib/            утилиты: score, rerun, capex, trace, force, format,
                  download, url, domain, validate
  mocks/          моковые данные и фикстуры (синхронизируются из ../docs)
tests/            зеркало src/ (Vitest + Testing Library)
scripts/          sync-fixtures.mjs — копирование фикстур из docs
```

## Экраны

Флотационный кейс (потери металла с хвостами). Переключатель фабрики в топбаре:
`kgmk` (полный сценарий с портфелем), `nof_vkr` / `nof_med` / `tof` (диагностика,
портфель — по запуску).

1. **Setup** — выбор фабрики, целевого элемента, цены и лимита CAPEX-класса.
2. **Run** — прогон пайплайна (сборка графа знаний) с анимацией стадий.
3. **Diagnosis** — тепловая карта потерь (класс крупности × минералогия),
   разбивка по диагнозам, data readiness.
4. **Hypotheses** — ранжированный портфель гипотез с деньгами, rerun-контролы
   (исключение фактора, вес cost, цена элемента) и детальный разбор гипотезы.
5. **Graph** — полный граф знаний: рычаги, механизмы, свойства, KPI.
6. **Benchmark** — сверка гипотез системы с экспертным мозговым штурмом.
7. **Library** — подключённая литература и данные, статус извлечения фактов.
8. **Report** — экспорт итогового портфеля (JSON / CSV).

## CI

GitHub Actions в корне монорепо (`../.github/workflows/`), фронтовый workflow
`frontend.yml` с path-фильтром на `frontend/**`:

- **Frontend** — lint, typecheck, test (с покрытием), build (артефакт `dist`) и
  `docker build` со smoke-тестом контейнера.
- **Security** — `pnpm audit` (fail на high/critical для prod-зависимостей + не
  блокирующий аудит dev-зависимостей), CodeQL (SAST) и gitleaks (поиск секретов);
  плюс еженедельный запуск по расписанию.

Dependabot обновляет npm/cargo/pip-зависимости и GitHub Actions еженедельно.

## Фикстуры

Единый источник фикстур — `../docs` (`docs/fixtures/*` и
`docs/golden/expert_hypotheses.json`). Локальные копии в `src/mocks/fixtures/`
обновляются командой `pnpm sync:fixtures`, чтобы не расходиться с контрактом
Demo/Data-трека.

## Контракты

Фронт согласован с Rust/Python API через типы в [src/contracts.ts](src/contracts.ts).
Пока backend недоступен, клиент возвращает данные из `src/mocks/`. При подключении
платформы добавляется второй клиент с той же сигнатурой `ApiClient` — компоненты
не меняются.
