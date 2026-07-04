from __future__ import annotations

from pathlib import Path

from app.pipeline.extract.documents import _doc_id


def test_doc_id_slugifies_cyrillic_filenames_without_collapsing_to_empty() -> None:
    # The corpus (norn-hack, norn-dop-data) is almost entirely Cyrillic-named;
    # an ASCII-only slug regex here used to collapse every such name to the
    # same empty "doc_" id, colliding every document's identity.
    doc_id = _doc_id(Path("Как читать отчет института по хвостам.docx"))

    assert doc_id != "doc_"
    assert doc_id == "doc_как_читать_отчет_института_по_хвостам"


def test_doc_id_stays_stable_and_unique_for_distinct_cyrillic_names() -> None:
    a = _doc_id(Path("28 Статья - Клименко И.В. (ЛГМ).docx"))
    b = _doc_id(Path("29 Статья - Другой автор.docx"))

    assert a != b
    assert a.startswith("doc_")
    assert b.startswith("doc_")
