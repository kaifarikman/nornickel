"""Run live extraction and refresh the extract fixture when it stays compatible."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from app.config import get_settings
from app.infra.paths import AGENT_SYSTEM_DIR, DOCS_DIR, REPO_ROOT
from app.pipeline.extract.service import extract_with_yandex
from app.pipeline.extract.validation import validate_extract_response
from app.schemas import DocumentInput, ExtractRequest, ExtractResponse

DEFAULT_DOCS = [
    (str(DOCS_DIR / "sample_docs" / "flotation" / "classification_notes.txt"), "text/plain"),
    (str(DOCS_DIR / "sample_docs" / "flotation" / "flotation_kinetics_notes.txt"), "text/plain"),
]


def main() -> None:
    args = _parse_args()
    request = ExtractRequest(
        pack_id=args.pack_id,
        docs=[DocumentInput(path=path, mime=mime) for path, mime in _docs_from_args(args.doc)],
    )
    settings = get_settings().model_copy(update={"database_url": ""})
    response = extract_with_yandex(request, settings=settings)
    validate_extract_response(response, request=request)

    candidate_path = args.candidate or _candidate_path(args.output)
    _write_response(candidate_path, response)
    _print_summary("candidate", candidate_path, response)

    if args.no_commit:
        return

    backup_path = args.output.with_suffix(args.output.suffix + ".bak")
    if args.output.exists():
        shutil.copy2(args.output, backup_path)

    shutil.copy2(candidate_path, args.output)
    validation = _run_fixture_validation()
    if validation.returncode == 0:
        if backup_path.exists():
            backup_path.unlink()
        print(validation.stdout.strip())
        print(f"committed {args.output}")
        return

    if backup_path.exists():
        shutil.copy2(backup_path, args.output)
        backup_path.unlink()

    print(validation.stdout.strip())
    print(validation.stderr.strip(), file=sys.stderr)
    print(
        f"fixture validation failed; restored {args.output} and kept candidate at {candidate_path}",
        file=sys.stderr,
    )
    raise SystemExit(validation.returncode)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack-id", default="flotation-v1")
    parser.add_argument(
        "--doc",
        action="append",
        default=[],
        help="Document as path:mime. Defaults to active DOCS_DIR/sample_docs/flotation/*.txt",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DOCS_DIR / "fixtures" / "extract_response.json",
    )
    parser.add_argument("--candidate", type=Path)
    parser.add_argument(
        "--no-commit",
        action="store_true",
        help="Only write candidate JSON and skip replacing the extract fixture.",
    )
    return parser.parse_args()


def _docs_from_args(raw_docs: list[str]) -> list[tuple[str, str]]:
    if not raw_docs:
        return DEFAULT_DOCS

    docs: list[tuple[str, str]] = []
    for raw in raw_docs:
        if ":" not in raw:
            raise SystemExit(f"invalid --doc value, expected path:mime: {raw}")
        path, mime = raw.rsplit(":", 1)
        docs.append((path, mime))
    return docs


def _write_response(path: Path, response: ExtractResponse) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = response.model_dump(mode="json")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _candidate_path(output: Path) -> Path:
    return output.with_name(output.stem + ".candidate" + output.suffix)


def _run_fixture_validation() -> subprocess.CompletedProcess[str]:
    validator = DOCS_DIR / "scripts" / "validate_fixtures.py"
    if not validator.exists():
        return subprocess.CompletedProcess(
            args=[str(validator)],
            returncode=0,
            stdout="fixture validation skipped: docs validator not found; pydantic validation passed",
            stderr="",
        )

    return subprocess.run(
        [sys.executable, str(validator)],
        cwd=REPO_ROOT if (REPO_ROOT / "docs").exists() else AGENT_SYSTEM_DIR,
        text=True,
        capture_output=True,
        check=False,
    )


def _print_summary(label: str, path: Path, response: ExtractResponse) -> None:
    canonical = sum(
        1
        for entity in response.entities
        if entity.properties.get("canonical_source") in {"pack.synonyms", "pack.diagnosis_config"}
    )
    unmatched = sum(
        1
        for entity in response.entities
        if entity.properties.get("normalization_warning") == "unmatched_pack_entity"
    )
    print(
        label,
        path,
        f"docs={len(response.documents)}",
        f"claims={len(response.claims)}",
        f"entities={len(response.entities)}",
        f"edges={len(response.edges)}",
        f"canonical={canonical}",
        f"unmatched={unmatched}",
    )


if __name__ == "__main__":
    main()
