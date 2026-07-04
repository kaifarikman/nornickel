"""Pydantic models for the Python sidecar JSON boundary."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


FactoryId = str
PackId = str

Section = Literal["rock", "pyrrhotite"]
Element = Literal["element_28", "element_29"]

MineralForm = Literal[
    "open_pnt_cp",
    "closed_pnt_cp",
    "pyrrhotite_impurity",
    "silicate_valleriite",
    "pyrite_other_sulfides",
    "millerite",
]

Diagnosis = Literal[
    "liberation_deficit",
    "slimes_overgrinding",
    "flotation_kinetics",
    "not_recoverable",
]

DataQualityCode = Literal[
    "ref_error",
    "merged_cell",
    "empty_slot",
    "checksum_mismatch",
    "parse_warning",
]

MimeType = Literal[
    "text/plain",
    "text/csv",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
EvidenceType = Literal["literature", "experiment", "expert_note", "data_gap", "inferred"]
NodeKind = Literal["factor", "mechanism", "property", "kpi"]
EdgeType = Literal["mechanism", "proxy", "tradeoff", "substitution"]
Polarity = Literal["positive", "negative", "nonlinear"]


class DiagnoseRequest(StrictModel):
    factory_id: FactoryId
    file_path: str
    pack_id: PackId


class ElementTotal(StrictModel):
    pct: float
    tons: float


class Totals(StrictModel):
    tails_smt: float
    element_28: ElementTotal
    element_29: ElementTotal


class LossCell(StrictModel):
    section: Section
    size_class: str
    mineral_form: MineralForm
    element: Element
    tons: float
    share_of_class_pct: float | None
    recoverable: bool
    diagnosis: Diagnosis
    cell_ref: str


class DiagnosisSummaryItem(StrictModel):
    diagnosis: Diagnosis
    element: Element
    tons: float


class DataQualityIssue(StrictModel):
    issue: DataQualityCode
    location: str
    handling: str
    delta_pct: float | None = None


class DiagnosticsReport(StrictModel):
    factory_id: FactoryId
    pack_id: PackId
    source_file: str
    sections: list[Section]
    totals: Totals
    loss_cells: list[LossCell]
    diagnosis_summary: list[DiagnosisSummaryItem]
    data_quality: list[DataQualityIssue]


class DocumentInput(StrictModel):
    path: str
    mime: MimeType


class ExtractRequest(StrictModel):
    docs: list[DocumentInput] = Field(default_factory=list)
    pack_id: PackId


class DocumentRef(StrictModel):
    id: str
    title: str
    path: str
    source_url: str | None = None


class Claim(StrictModel):
    id: str
    text: str
    source_ref: str
    source_page: int | None
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_type: EvidenceType


class GraphNode(StrictModel):
    id: str
    kind: NodeKind
    label: str
    tags: list[str] = Field(default_factory=list)
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(StrictModel):
    id: str
    src: str
    dst: str
    edge_type: EdgeType
    mechanism: str
    source_claims: list[str] = Field(default_factory=list)
    polarity: Polarity


class ExtractResponse(StrictModel):
    pack_id: PackId
    documents: list[DocumentRef]
    claims: list[Claim]
    entities: list[GraphNode]
    edges: list[GraphEdge]


class EmbedRequest(StrictModel):
    texts: list[str] = Field(min_length=1)


class EmbedResponse(StrictModel):
    vectors: list[list[float]]


class RetrieveRequest(StrictModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=50)


class RetrievedChunk(StrictModel):
    chunk_id: str
    document_id: str
    page: int | None
    text: str
    score: float


class RetrieveResponse(StrictModel):
    chunks: list[RetrievedChunk]


class NoveltyRequest(StrictModel):
    hypothesis_text: str
    top_k: int = Field(default=5, ge=1, le=50)


class NoveltySimilar(StrictModel):
    doc: str
    page: int | None
    score: float
    text: str


class NoveltyResponse(StrictModel):
    novelty_score: float = Field(ge=0.0, le=1.0)
    similar: list[NoveltySimilar]


class SkepticRequest(StrictModel):
    hypothesis: dict[str, Any]


class SkepticResponse(StrictModel):
    objection: str
    missing_evidence: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    suggested_checks: list[str] = Field(default_factory=list)


class NarrateRequest(StrictModel):
    hypothesis: dict[str, Any]
    skeptic: dict[str, Any] | None = None
    novelty: dict[str, Any] | None = None


class NarrateResponse(StrictModel):
    text: str = Field(min_length=1)


RerunActionKind = Literal[
    "exclude_factor",
    "change_weight",
    "add_constraint",
    "relax_constraint",
    "change_price",
]


class RerunAction(StrictModel):
    kind: RerunActionKind
    payload: dict[str, Any] = Field(default_factory=dict)


class ConstraintFactor(StrictModel):
    id: str
    label: str


class ParseConstraintsRequest(StrictModel):
    text: str
    kpi_contract: dict[str, Any]
    pack_id: PackId
    factors: list[ConstraintFactor] = Field(default_factory=list)


class ParseConstraintsResponse(StrictModel):
    actions: list[RerunAction] = Field(default_factory=list)
    kpi_contract_patch: dict[str, Any] = Field(default_factory=dict)
    unparsed: list[str] = Field(default_factory=list)
