"""PostgreSQL storage for live extraction inputs and outputs."""

from __future__ import annotations

import hashlib
from typing import Protocol
from uuid import uuid4

from app.config import Settings
from app.schemas import DocumentRef, EmbedResponse, ExtractRequest, ExtractResponse


class DbNotConfiguredError(RuntimeError):
    """Эндпоинт требует Postgres, а DATABASE_URL пуст (mock-путь БД не использует)."""

    def __init__(self) -> None:
        super().__init__("DATABASE_URL is not configured")


class ChunkLike(Protocol):
    """Structural view of a parsed chunk the DB layer persists.

    Declared here so infra does not import from the pipeline (extract) domain —
    the concrete DocumentChunk lives in app.pipeline.extract.documents.
    """

    doc_id: str
    page: int | None
    text: str


type StoredChunk = tuple[str, str, int | None, str]
# (chunk_id, document_id, page, text, cosine_similarity)
type ScoredChunk = tuple[str, str, int | None, str, float]


def _vec_literal(vector: list[float]) -> str:
    """pgvector text literal, e.g. [0.1,0.2,0.3]. Round-trippable floats."""
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


def store_live_extraction(
    *,
    settings: Settings,
    request: ExtractRequest,
    documents: list[DocumentRef],
    chunks: list[ChunkLike],
    response: ExtractResponse,
) -> str | None:
    if not settings.database_url:
        return None

    import psycopg
    from psycopg.types.json import Jsonb

    run_id = str(uuid4())
    with psycopg.connect(settings.database_url) as conn:
        _ensure_schema(conn)
        with conn.cursor() as cur:
            for document in documents:
                mime = _mime_for_path(request, document.path)
                cur.execute(
                    """
                    insert into documents (id, title, path, mime, source_url)
                    values (%s, %s, %s, %s, %s)
                    on conflict (id) do update set
                        title = excluded.title,
                        path = excluded.path,
                        mime = excluded.mime,
                        source_url = excluded.source_url
                    """,
                    (document.id, document.title, document.path, mime, document.source_url),
                )

            for chunk in chunks:
                cur.execute(
                    """
                    insert into chunks (id, document_id, page, text)
                    values (%s, %s, %s, %s)
                    on conflict (id) do update set
                        document_id = excluded.document_id,
                        page = excluded.page,
                        text = excluded.text
                    """,
                    (_chunk_id(chunk), chunk.doc_id, chunk.page, chunk.text),
                )

            cur.execute(
                """
                insert into extraction_runs
                    (id, pack_id, model, request_json, response_json)
                values (%s, %s, %s, %s, %s)
                """,
                (
                    run_id,
                    request.pack_id,
                    settings.extract_model_uri,
                    Jsonb(request.model_dump(mode="json")),
                    Jsonb(response.model_dump(mode="json")),
                ),
            )
    return run_id


def store_text_embeddings(
    *,
    settings: Settings,
    texts: list[str],
    response: EmbedResponse,
) -> None:
    if not settings.database_url:
        return

    import psycopg

    with psycopg.connect(settings.database_url) as conn:
        _ensure_schema(conn)
        with conn.cursor() as cur:
            for text, vector in zip(texts, response.vectors, strict=True):
                cur.execute(
                    """
                    insert into text_embeddings (id, model, text, embedding)
                    values (%s, %s, %s, %s::vector)
                    on conflict (id, model) do update set
                        text = excluded.text,
                        embedding = excluded.embedding,
                        created_at = now()
                    """,
                    (_text_embedding_id(text), settings.embedding_model_uri, text, _vec_literal(vector)),
                )


def load_chunks_without_embeddings(settings: Settings, limit: int = 100) -> list[StoredChunk]:
    if not settings.database_url:
        return []

    import psycopg

    with psycopg.connect(settings.database_url) as conn:
        _ensure_schema(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                select c.id, c.document_id, c.page, c.text
                from chunks c
                left join chunk_embeddings e
                    on e.chunk_id = c.id and e.model = %s
                where e.chunk_id is null
                order by c.created_at asc
                limit %s
                """,
                (settings.embedding_document_model_uri, limit),
            )
            return [(row[0], row[1], row[2], row[3]) for row in cur.fetchall()]


def store_chunk_embeddings(
    *,
    settings: Settings,
    chunks: list[StoredChunk],
    response: EmbedResponse,
) -> None:
    if not settings.database_url:
        return

    import psycopg

    with psycopg.connect(settings.database_url) as conn:
        _ensure_schema(conn)
        with conn.cursor() as cur:
            for chunk, vector in zip(chunks, response.vectors, strict=True):
                cur.execute(
                    """
                    insert into chunk_embeddings (chunk_id, model, embedding)
                    values (%s, %s, %s::vector)
                    on conflict (chunk_id, model) do update set
                        embedding = excluded.embedding,
                        created_at = now()
                    """,
                    (chunk[0], settings.embedding_document_model_uri, _vec_literal(vector)),
                )


def search_chunks(
    settings: Settings,
    query_vector: list[float],
    top_k: int,
) -> list[ScoredChunk]:
    """Top-k chunks by cosine similarity, ranked in Postgres via pgvector `<=>`.

    Cosine distance (`<=>`) is 1 - cosine_similarity, so similarity = 1 - distance.
    Ordering and the LIMIT run in the database; no vectors are pulled into Python.
    """
    if not settings.database_url:
        return []

    import psycopg

    literal = _vec_literal(query_vector)
    with psycopg.connect(settings.database_url) as conn:
        _ensure_schema(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                select c.id, c.document_id, c.page, c.text,
                       1 - (e.embedding <=> %s::vector) as similarity
                from chunks c
                join chunk_embeddings e on e.chunk_id = c.id
                where e.model = %s
                order by e.embedding <=> %s::vector
                limit %s
                """,
                (literal, settings.embedding_document_model_uri, literal, top_k),
            )
            return [(row[0], row[1], row[2], row[3], float(row[4])) for row in cur.fetchall()]


def _ensure_schema(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("create extension if not exists vector")
        cur.execute(
            """
            create table if not exists documents (
                id text primary key,
                title text not null,
                path text not null,
                mime text not null,
                source_url text,
                created_at timestamptz not null default now()
            )
            """
        )
        cur.execute(
            """
            create table if not exists chunks (
                id text primary key,
                document_id text not null references documents(id) on delete cascade,
                page integer,
                text text not null,
                created_at timestamptz not null default now()
            )
            """
        )
        cur.execute(
            """
            create table if not exists extraction_runs (
                id uuid primary key,
                pack_id text not null,
                model text not null,
                request_json jsonb not null,
                response_json jsonb not null,
                created_at timestamptz not null default now()
            )
            """
        )
        cur.execute(
            """
            create table if not exists text_embeddings (
                id text not null,
                model text not null,
                text text not null,
                embedding vector not null,
                created_at timestamptz not null default now(),
                primary key (id, model)
            )
            """
        )
        cur.execute(
            """
            create table if not exists chunk_embeddings (
                chunk_id text not null references chunks(id) on delete cascade,
                model text not null,
                embedding vector not null,
                created_at timestamptz not null default now(),
                primary key (chunk_id, model)
            )
            """
        )
        # Migrate DBs provisioned before the pgvector switch: legacy `double
        # precision[]` (udt_name _float8) → `vector`. Idempotent — only fires
        # when the old array type is still present, so it never rewrites an
        # already-migrated table on subsequent connections.
        cur.execute(
            """
            do $$
            begin
                if exists (
                    select 1 from information_schema.columns
                    where table_name = 'chunk_embeddings'
                      and column_name = 'embedding' and udt_name = '_float8'
                ) then
                    alter table chunk_embeddings
                        alter column embedding type vector using embedding::vector;
                end if;
                if exists (
                    select 1 from information_schema.columns
                    where table_name = 'text_embeddings'
                      and column_name = 'embedding' and udt_name = '_float8'
                ) then
                    alter table text_embeddings
                        alter column embedding type vector using embedding::vector;
                end if;
            end $$;
            """
        )
        # NOTE: an approximate HNSW index (create index ... using hnsw (embedding
        # vector_cosine_ops)) needs a fixed embedding dimension. Add it once the
        # Yandex embedding model is pinned; for the demo corpus exact KNN via `<=>`
        # is fast enough and works for any dimension.


def _chunk_id(chunk: ChunkLike) -> str:
    raw = f"{chunk.doc_id}|{chunk.page}|{chunk.text}".encode()
    return "chunk_" + hashlib.sha256(raw).hexdigest()[:24]


def _text_embedding_id(text: str) -> str:
    return "emb_" + hashlib.sha256(text.encode("utf-8")).hexdigest()[:24]


def _mime_for_path(request: ExtractRequest, path: str) -> str:
    for document in request.docs:
        if document.path == path:
            return document.mime
    return "application/octet-stream"
