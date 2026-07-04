# BUILD.md

## Раскладка (monorepo)
crates/{contracts,engine,platform}  ·  sidecar (python)  ·  web (react/ts)  ·  packs (domain packs)

## Тулчейн
- Rust stable (workspace), `cargo`
- Python 3.11+, `uv` или venv, `sidecar/requirements.txt`
- Node 20+, `pnpm`
- Tauri CLI: `cargo install tauri-cli`
- (опц.) `just` как раннер команд

## Команды
- `just build` → `cargo build --workspace` + `pnpm -C web build`
- `just dev`   → поднять axum (platform) + vite (web) + sidecar; либо `cargo tauri dev`
- Сайдкар отдельно: `cd sidecar && uvicorn app:api --port 8765`
- Desktop-сборка: `cargo tauri build` (python кладётся как sidecar-бинарь/процесс)

## Порядок старта
1) sidecar (8765) → 2) platform/axum (8080, спавнит sidecar) → 3) web (5173, → 8080)

## Sidecar: запуск и health-check

**Команда запуска:**
```bash
cd sidecar && uvicorn app:api --host 127.0.0.1 --port 8765
```

**Health-check эндпоинт:** `GET http://127.0.0.1:8765/health` → `{"status": "ok"}`

**Tauri (platform) при старте:**
1. Спавнит сайдкар как дочерний процесс.
2. Поллит `/health` с интервалом 200ms до 10 секунд — если не поднялся, показывает ошибку пользователю.
3. При падении сайдкара — логирует stderr, показывает уведомление в UI, не крашит Tauri-процесс.

**При разработке без Tauri:** запустить сайдкар вручную перед `just dev`.
