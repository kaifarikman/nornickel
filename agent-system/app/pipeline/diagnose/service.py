"""XLSX diagnostics endpoint service."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import yaml

from app.infra.paths import DOCS_DIR, resolve_repo_path
from app.pipeline.diagnose.parser import (
    DEFAULT_DIAGNOSIS_CONFIG,
    DiagnosisConfig,
    parse_tails,
)
from app.schemas import DiagnoseRequest, DiagnosticsReport

# Мягкий диапазон расхождений (1–5%) остаётся репортом в data_quality;
# выше — файл считается противоречивым сам себе → 422 CHECKSUM_MISMATCH.
CHECKSUM_HARD_LIMIT_PCT = 5.0


class ChecksumMismatchError(ValueError):
    """Суммы в xlsx расходятся с контрольными строками сильнее допустимого."""

    def __init__(self, issues: list[dict[str, Any]]) -> None:
        self.issues = issues
        worst = max(issue.get("delta_pct", 0.0) for issue in issues)
        super().__init__(f"checksum mismatch above {CHECKSUM_HARD_LIMIT_PCT}% (worst {worst}%)")


def diagnose_xlsx(request: DiagnoseRequest) -> DiagnosticsReport:
    source_path = resolve_repo_path(request.file_path)
    if not source_path.exists():
        raise FileNotFoundError(request.file_path)

    config = _diagnosis_config_from_pack(request.pack_id) or DEFAULT_DIAGNOSIS_CONFIG
    report: dict[str, Any] = parse_tails(source_path, request.factory_id, config)

    hard_issues = [
        issue
        for issue in report["data_quality"]
        if issue.get("issue") == "checksum_mismatch"
        and issue.get("delta_pct", 0.0) > CHECKSUM_HARD_LIMIT_PCT
    ]
    if hard_issues:
        raise ChecksumMismatchError(hard_issues)

    report["pack_id"] = request.pack_id
    report["source_file"] = request.file_path
    return DiagnosticsReport.model_validate(report)


@lru_cache(maxsize=4)
def _diagnosis_config_from_pack(pack_id: str) -> DiagnosisConfig | None:
    """Секция diagnosis_config из packs/<pack_id>.yaml; None → fallback-константы парсера."""
    pack_path = DOCS_DIR / "packs" / f"{pack_id}.yaml"
    if not pack_path.exists():
        return None
    section = yaml.safe_load(pack_path.read_text(encoding="utf-8")).get("diagnosis_config")
    if not section:
        return None

    rules: list[dict[str, Any]] = []
    for rule in section["rules"]:
        when = rule.get("when", {})
        mapped: dict[str, Any] = {"diagnosis": rule["diagnosis"]}
        if "recoverable" in when:
            mapped["recoverable"] = when["recoverable"]
        if "mineral_form" in when:
            mapped["mineral_form"] = when["mineral_form"]
        if "size_group" in when:
            mapped["size_groups"] = set(when["size_group"])
        rules.append(mapped)

    return DiagnosisConfig(
        size_groups=section["size_class_groups"],
        recoverability={el: set(forms) for el, forms in section["recoverability"].items()},
        rules=rules,
    )
