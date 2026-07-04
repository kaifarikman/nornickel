# Nornickel Hypothesis Factory — команды запуска.
# Полный стек: docker compose (frontend :80, backend :8080, sidecar :8765).
# Стек работает без .env, LLM-ключей и Postgres (Postgres — опция, профиль rag).

COMPOSE ?= docker compose

.DEFAULT_GOAL := help

.PHONY: help build up down stop logs ps restart smoke front rag-up clean

help: ## показать список команд
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-10s %s\n", $$1, $$2}'

build: ## собрать все docker-образы
	$(COMPOSE) build

up: ## поднять стек в фоне (с пересборкой)
	$(COMPOSE) up -d --build
	@echo "frontend: http://localhost · backend: http://localhost:8080 · sidecar: http://localhost:8765"

down: ## остановить и удалить контейнеры
	$(COMPOSE) down

logs: ## хвост логов всех сервисов
	$(COMPOSE) logs -f --tail=100

ps: ## статус контейнеров
	$(COMPOSE) ps

restart: down up ## перезапустить стек

smoke: ## smoke-проверка API (прогон КГМК, benchmark, экспорт)
	@curl -sS -XPOST http://localhost:8080/run \
		-H 'content-type: application/json' \
		-d '{"factory_id":"kgmk","pack_id":"flotation-v1"}' >/dev/null && echo "run kgmk      OK"
	@curl -sS http://localhost:8080/benchmark >/dev/null && echo "benchmark     OK"
	@curl -sS http://localhost:8080/export/board.csv >/dev/null && echo "export csv    OK"

front: ## только UI без бэкенда — фикстурный режим (http://localhost:5173)
	cd frontend && pnpm install && pnpm dev

rag-up: ## стек + Postgres/pgvector (профиль rag)
	$(COMPOSE) --profile rag up -d --build

clean: ## снести контейнеры вместе с volume'ами
	$(COMPOSE) down -v
