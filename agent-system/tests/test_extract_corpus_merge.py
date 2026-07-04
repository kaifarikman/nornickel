from app.pipeline.extract.service import LlmExtractPayload
from app.scripts.extract_corpus import merge_payloads
from app.schemas import Claim, DocumentRef, GraphEdge, GraphNode


def test_merge_payloads_renumbers_claims_edges_and_drops_broken_edges() -> None:
    documents = [DocumentRef(id="doc_a", title="A", path="a.txt", source_url=None)]
    payloads = [
        LlmExtractPayload(
            claims=[
                Claim(
                    id="claim_001",
                    text="First claim",
                    source_ref="doc_a",
                    source_page=None,
                    confidence=0.8,
                    evidence_type="literature",
                )
            ],
            entities=[
                GraphNode(id="node_factor", kind="factor", label="Factor"),
                GraphNode(id="node_kpi", kind="kpi", label="KPI"),
            ],
            edges=[
                GraphEdge(
                    id="edge_001",
                    src="node_factor",
                    dst="node_kpi",
                    edge_type="mechanism",
                    mechanism="valid path",
                    source_claims=["claim_001"],
                    polarity="positive",
                )
            ],
        ),
        LlmExtractPayload(
            claims=[
                Claim(
                    id="claim_001",
                    text="Second claim",
                    source_ref="doc_a",
                    source_page=None,
                    confidence=0.7,
                    evidence_type="experiment",
                )
            ],
            entities=[
                GraphNode(id="node_factor", kind="factor", label="Factor"),
                GraphNode(id="node_property", kind="property", label="Property"),
            ],
            edges=[
                GraphEdge(
                    id="edge_001",
                    src="node_factor",
                    dst="node_property",
                    edge_type="mechanism",
                    mechanism="another valid path",
                    source_claims=["claim_001"],
                    polarity="negative",
                ),
                GraphEdge(
                    id="edge_002",
                    src="node_missing",
                    dst="node_property",
                    edge_type="mechanism",
                    mechanism="broken node ref",
                    source_claims=["claim_001"],
                    polarity="positive",
                ),
                GraphEdge(
                    id="edge_003",
                    src="node_factor",
                    dst="node_property",
                    edge_type="mechanism",
                    mechanism="broken claim ref",
                    source_claims=["claim_missing"],
                    polarity="positive",
                ),
            ],
        ),
    ]

    result = merge_payloads(payloads, documents, "flotation-v1")

    assert [claim.id for claim in result.response.claims] == ["claim_001", "claim_002"]
    assert [edge.id for edge in result.response.edges] == ["edge_001", "edge_002"]
    assert [edge.source_claims for edge in result.response.edges] == [["claim_001"], ["claim_002"]]
    assert result.dropped_edges == 2
