from __future__ import annotations

from pathlib import Path

AGENT_SYSTEM_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = AGENT_SYSTEM_DIR.parent
RESOURCES_DIR = AGENT_SYSTEM_DIR / "resources"

_EXTERNAL_DOCS_DIR = REPO_ROOT / "docs"
DOCS_DIR = _EXTERNAL_DOCS_DIR if _EXTERNAL_DOCS_DIR.exists() else RESOURCES_DIR
FIXTURES_DIR = DOCS_DIR / "fixtures"


class PathEscapesRepoError(ValueError):
    """A request-supplied path is absolute or escapes REPO_ROOT via `..`."""

    def __init__(self, path: str) -> None:
        self.path = path
        super().__init__(f"path escapes REPO_ROOT: {path}")


def resolve_repo_path(path: str) -> Path:
    """Resolve a request-supplied relative path against REPO_ROOT.

    /diagnose and live /extract take file paths straight from request bodies
    with no other access control, so a relative-only, traversal-checked
    resolution is the only thing standing between a caller and arbitrary
    file reads on the container's filesystem.
    """
    candidate = Path(path)
    if candidate.is_absolute():
        raise PathEscapesRepoError(path)
    # Dotfiles/dotdirs (.env, .git, ...) hold secrets and VCS internals that are
    # inside REPO_ROOT but must never be served, so reject any dot-prefixed part.
    if any(part.startswith(".") for part in candidate.parts):
        raise PathEscapesRepoError(path)
    resolved = (REPO_ROOT / candidate).resolve()
    if REPO_ROOT not in resolved.parents:
        raise PathEscapesRepoError(path)
    return resolved
