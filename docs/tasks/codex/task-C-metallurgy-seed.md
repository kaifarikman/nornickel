# Task C — металлургическая заготовка (3-й проверочный промт жюри)

## Проблема

Один из трёх проверочных промтов жюри — металлургия («шлаки, схема цепи
аппаратов, БЕЗ xlsx хвостов»). Сейчас claims-only-путь `/run` для неизвестной
фабрики не падает, но выдаёт ПУСТОЙ портфель (claims в фикстуре — только
флотация) — на метал-промте решение покажет ноль. Питч «домен = pack, ядро не
трогаем» надо подтвердить делом: metallurgy-pack + метал-claims.

## Данные

Локально (НЕ в гите, 4.9 ГБ): `norn-dop-data/Источники информации/…` — статьи
Норникеля. Релевантные металлургии (docx, парсятся `parse_docx_file`):
- `Статьи/17 ИССЛЕДОВАНИЕ ВЛИЯНИЯ ТЕМПЕРАТУРНОГО РЕЖИМА ПРОЦЕССА ОБЕДНЕНИЯ ШЛАКА НА КОАЛЕСЦЕНЦИЮ ЧАСТИЦ МЕТАЛЛИЧЕСКОЙ ФАЗЫ.docx`
- `Статьи/44 ИССЛЕДОВАНИЕ ПРОЦЕССА ГРАНУЛЯЦИИ МЕДНО-НИКЕЛЕВЫХ ШТЕЙНОВ.docx`
- поискать в `Статьи/`/`Обзоры/` ещё 1–3 про обеднение шлаков / штейны / плавку.

## Шаги

1. Скопировать выбранные 3–5 docx в `docs/sample_docs/metallurgy/` (несколько
   сотен КБ — можно в гит; материалы выданы организаторами для использования
   в решении).
2. `docs/packs/metallurgy-v1.yaml` — минимальный pack по образцу
   `flotation-v1.yaml`: pack_id, scoring_weights (те же), enabled_operators
   (mechanism_path, gap, uncovered_constraint), default_gain_pct_range,
   synonyms под металлургию (шлак/slag, штейн/matte, обеднение, электропечь,
   гранулция, температурный режим...). Секция diagnosis_config НЕ нужна
   (диагнозов из xlsx в этом кейсе нет).
3. `docs/extract_corpus_metallurgy.json` — конфиг корпуса из скопированных docx.
4. Прогнать Task-A-скрипт с этим конфигом (нужен ключ; если ключа нет — собрать
   15–20 claims вручную-честно: цитата из статьи + документ, оформить тем же
   скриптом с флагом `--from-json` или просто руками по схеме) →
   `docs/fixtures/extract_response_metallurgy.json`.
5. Backend — выбор фикстуры/корпуса по `pack_id`. Механику НЕ переписывать с нуля,
   расширить существующую (см. текущее состояние ниже):
   - Порт `ExtractSource::load` сейчас `fn load(&self) -> Result<ExtractResponse, String>`
     (`crates/platform/src/application/ports.rs:11`). Добавить аргумент:
     `fn load(&self, pack_id: &str)`.
   - Вызовов ровно два (board.rs extract НЕ грузит — НЕ трогать):
     `application/run.rs:40` (`extract_source.load()` → передать `&pack_id`, он там
     уже вычислен строкой выше) и `application/factories.rs:23`
     (`base_extract = extract_source.load()` → передать pack фабричного прогона,
     по умолчанию `"flotation-v1"`).
   - `FileExtractSource` (`infrastructure/file_extract_source.rs`): сейчас путь
     фикстуры строится в `new` как `base_dir/fixtures/extract_response.json`.
     Сохранить `base_dir` в структуре и в `load(pack_id)` выбирать
     `fixtures/extract_response_{pack_id}.json` если существует, иначе
     `fixtures/extract_response.json`.
   - `HttpExtractSource` (`infrastructure/http_sidecar.rs`): сейчас хранит
     `corpus_config = base_dir/extract_corpus.json` (построен в `new`) и читает его
     в методе `live_extract_docs()`; fallback — тот же `FileExtractSource`.
     Сохранить `base_dir`, а в `live_extract_docs`/`load` выбирать
     `extract_corpus_{pack_id}.json` если существует, иначе `extract_corpus.json`;
     fallback-фикстуру грузить с тем же pack_id.
   - Контракт HTTP НЕ меняется (pack_id в RunRequest уже есть).
6. Смоук: `POST /run {"factory_id":"slag_case","pack_id":"metallurgy-v1"}` →
   claims-only портфель с метал-гипотезами (без тоннажа/денег — это ок, пометка
   `no quantitative diagnostics` уже реализована), `/trace` ведёт к статьям.

## Приёмка

- Флотационный путь НЕ изменился: `/run kgmk` — тот же hash, что до таска.
- Метал-run выдаёт ≥3 осмысленные гипотезы с trace до статей.
- В `crates/engine` не появилось ни одного доменного слова (grep:
  `slag|шлак|штейн|металлург` по crates/engine — пусто).
- Все тесты зелёные.

## Не делать

- Не монтировать norn-dop-data целиком в docker (гигабайты, приватное).
- Не выдумывать claims без источника — каждый claim с реальным doc/цитатой.
