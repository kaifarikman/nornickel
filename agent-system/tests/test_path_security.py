from __future__ import annotations

import pytest

from app.infra.paths import REPO_ROOT, PathEscapesRepoError, resolve_repo_path


def test_resolve_repo_path_accepts_relative_path_under_repo_root() -> None:
    resolved = resolve_repo_path("norn-hack/Пример 1/Хвосты КГМК.xlsx")

    assert resolved == REPO_ROOT / "norn-hack/Пример 1/Хвосты КГМК.xlsx"


def test_resolve_repo_path_rejects_absolute_path() -> None:
    with pytest.raises(PathEscapesRepoError):
        resolve_repo_path("/etc/passwd")


def test_resolve_repo_path_rejects_dotdot_traversal() -> None:
    with pytest.raises(PathEscapesRepoError):
        resolve_repo_path("../../../../etc/passwd")


def test_diagnose_route_treats_traversal_as_file_not_found() -> None:
    from fastapi.testclient import TestClient

    from app.api.main import app

    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/diagnose",
        json={
            "factory_id": "kgmk",
            "pack_id": "flotation-v1",
            "file_path": "../../../../etc/passwd",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "XLSX_PARSE_ERROR"
