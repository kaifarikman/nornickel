from __future__ import annotations

from app.pipeline.extract.documents import DOCX_MIME
from app.schemas import ExtractRequest, ExtractResponse


def validate_extract_response(response: ExtractResponse, request: ExtractRequest | None = None) -> None:
    """Check cross-object references that Pydantic cannot validate locally."""
    _ensure_unique("document id", [document.id for document in response.documents])
    _ensure_unique("claim id", [claim.id for claim in response.claims])
    _ensure_unique("entity id", [entity.id for entity in response.entities])
    _ensure_unique("edge id", [edge.id for edge in response.edges])

    document_ids = {document.id for document in response.documents}
    claim_ids = {claim.id for claim in response.claims}
    entity_ids = {entity.id for entity in response.entities}
    mime_by_path = _request_mime_by_path(request)

    for claim in response.claims:
        if claim.source_ref not in document_ids:
            raise ValueError(f"claim {claim.id} references unknown document {claim.source_ref}")

        document = next(document for document in response.documents if document.id == claim.source_ref)
        mime = mime_by_path.get(document.path)
        if mime == "application/pdf" and claim.source_page is None:
            raise ValueError(f"claim {claim.id} from PDF document {claim.source_ref} must have source_page")
        if mime in {"text/plain", "text/csv", DOCX_MIME} and claim.source_page is not None:
            raise ValueError(f"claim {claim.id} from text document {claim.source_ref} must not have source_page")

    for edge in response.edges:
        if edge.src not in entity_ids:
            raise ValueError(f"edge {edge.id} references unknown src entity {edge.src}")
        if edge.dst not in entity_ids:
            raise ValueError(f"edge {edge.id} references unknown dst entity {edge.dst}")
        if not edge.source_claims:
            raise ValueError(f"edge {edge.id} must reference at least one source claim")
        for claim_id in edge.source_claims:
            if claim_id not in claim_ids:
                raise ValueError(f"edge {edge.id} references unknown source claim {claim_id}")


def _ensure_unique(label: str, values: list[str]) -> None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            raise ValueError(f"duplicate {label}: {value}")
        seen.add(value)


def _request_mime_by_path(request: ExtractRequest | None) -> dict[str, str]:
    if request is None:
        return {}
    return {document.path: document.mime for document in request.docs}
