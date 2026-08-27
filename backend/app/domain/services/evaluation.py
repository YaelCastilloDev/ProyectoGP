"""Offline evaluation of the recommender.

Verification methodology (leave-one-out on tickets, temporal split):

1. Tickets are split by date: `fecha < split_date` trains, the rest tests.
   This simulates recommending with only past knowledge.
2. For each test ticket and each product in it, the engine is asked for
   top-K recommendations given that single product. The rest of the
   ticket is the ground truth ("what else did the customer actually buy").
3. Metrics:
   - HitRate@K: share of queries where at least one held-out item made
     the top-K (recall-oriented).
   - Precision@K: share of the top-K that were held-out items.
   - Coverage: share of the in-stock catalog that appears at least once
     in any recommendation list (guards against a popularity-only
     engine that always suggests the same handful of products).
4. Every signal is evaluated in isolation (ablation) plus the hybrid,
   and compared against two baselines: random and global popularity.

Caveat: the seed dataset contains 42 tickets, so the numbers are
directional, not statistically conclusive. With production volumes the
same harness supports NDCG, per-store significance tests and online CTR.
"""

from datetime import date
from random import Random

from pydantic import BaseModel

from backend.app.domain.entities import (
    DEFAULT_BLEND_WEIGHTS,
    BlendWeights,
    Product,
    SaleRow,
)
from backend.app.domain.services.recommender.content import ContentSimilarity
from backend.app.domain.services.recommender.cooccurrence import CooccurrenceSimilarity
from backend.app.domain.services.recommender.engine import RecommenderEngine
from backend.app.domain.services.recommender.popularity import PopularityModel

CAVEATS = [
    "Dataset pequeño (42 tickets): los resultados son direccionales, no concluyentes.",
    "Mérida no tiene historial de ventas: solo aplican las señales de contenido y "
    "popularidad global (caso de arranque en frío).",
    "El filtro de stock>0 usa el inventario actual; con historial real habría que "
    "reconstruir el stock histórico por fecha.",
]


class StrategyResult(BaseModel):
    name: str
    n_queries: int
    n_hits: int
    hit_rate: float
    precision: float
    coverage: float


class EvaluationReport(BaseModel):
    split_date: date
    k: int
    n_train_tickets: int
    n_test_tickets: int
    strategies: list[StrategyResult]
    hybrid_by_store: dict[str, float]
    caveats: list[str] = CAVEATS


def _split_tickets(sales: list[SaleRow], split_date: date) -> tuple[list[SaleRow], list[SaleRow]]:
    tickets: dict[str, list[SaleRow]] = {}
    for row in sales:
        tickets.setdefault(row.ticket_id, []).append(row)

    train = [row for rows in tickets.values() if rows[0].fecha < split_date for row in rows]
    test = [row for rows in tickets.values() if rows[0].fecha >= split_date for row in rows]
    return train, test


def _run_strategy(
    engine_build,
    test_tickets: list[list[SaleRow]],
    catalog: list[Product],
    k: int,
    store_id: int = 0,
) -> StrategyResult:
    hits = 0
    precisions = []
    recommended_ever: set[str] = set()

    for ticket in test_tickets:
        skus = {row.sku for row in ticket}
        for seed in skus:
            truth = skus - {seed}
            if not truth:
                continue
            recs = engine_build().recommend([seed], store_id=store_id, limit=k)
            recommended_ever.update(rec.sku for rec in recs)
            hit_items = {rec.sku for rec in recs} & truth
            hits += 1 if hit_items else 0
            precisions.append(len(hit_items) / k if recs else 0.0)

    n_queries = len(precisions)
    in_stock = {p.sku for p in catalog if p.stock > 0}
    coverage = len(recommended_ever & in_stock) / len(in_stock) if in_stock else 0.0
    return StrategyResult(
        name="",
        n_queries=n_queries,
        n_hits=hits,
        hit_rate=round(hits / n_queries, 4) if n_queries else 0.0,
        precision=round(sum(precisions) / n_queries, 4) if n_queries else 0.0,
        coverage=round(coverage, 4),
    )


def run_offline_evaluation(
    products: list[Product],
    sales: list[SaleRow],
    split_date: date,
    k: int = 5,
    seed: int = 42,
) -> EvaluationReport:
    train, test = _split_tickets(sales, split_date)
    test_tickets = list(_group(test).values())

    content = ContentSimilarity(products)
    cooc = CooccurrenceSimilarity(train)
    popularity = PopularityModel(train)

    def make_engine(weights: BlendWeights | None = None) -> RecommenderEngine:
        return RecommenderEngine(
            products=products,
            content=content,
            cooccurrence=cooc,
            popularity=popularity,
            weights=weights or BlendWeights(store_id=0, **DEFAULT_BLEND_WEIGHTS),
        )

    strategies: list[tuple[str, object]] = [
        ("random", None),
        (
            "popularity_baseline",
            make_engine(BlendWeights(store_id=0, w_popularity=1.0, w_content=0, w_cooccurrence=0)),
        ),
        (
            "cooccurrence",
            make_engine(BlendWeights(store_id=0, w_cooccurrence=1.0, w_content=0, w_popularity=0)),
        ),
        (
            "content",
            make_engine(BlendWeights(store_id=0, w_content=1.0, w_cooccurrence=0, w_popularity=0)),
        ),
        ("hybrid", make_engine()),
    ]

    results: list[StrategyResult] = []
    random_generator = Random(seed)
    in_stock_skus = [p.sku for p in products if p.stock > 0]

    for name, engine_or_none in strategies:
        if name == "random":
            result = _run_random_strategy(random_generator, in_stock_skus, test_tickets, k)
        else:
            result = _run_strategy(lambda e=engine_or_none: e, test_tickets, products, k)
        result.name = name
        results.append(result)

    hybrid_by_store: dict[str, float] = {}
    for store_id, store_tickets in _group_by_store(test).items():
        if not store_tickets:
            continue
        # Use a dedicated engine with store-aware popularity scoring
        per_store = _run_strategy(
            lambda store_id=store_id: RecommenderEngine(
                products=products,
                content=content,
                cooccurrence=cooc,
                popularity=popularity,
                weights=BlendWeights(store_id=store_id, **DEFAULT_BLEND_WEIGHTS),
            ),
            list(_group(store_tickets).values()),
            products,
            k,
            store_id=store_id,
        )
        hybrid_by_store[f"store_{store_id}"] = per_store.hit_rate

    n_train_tickets = len(_group(train))
    n_test_tickets = len(_group(test))
    return EvaluationReport(
        split_date=split_date,
        k=k,
        n_train_tickets=n_train_tickets,
        n_test_tickets=n_test_tickets,
        strategies=results,
        hybrid_by_store=hybrid_by_store,
    )


def _run_random_strategy(
    random_generator: Random,
    catalog_skus: list[str],
    test_tickets: list[list[SaleRow]],
    k: int,
) -> StrategyResult:
    """Baseline: suggest k random in-stock products."""
    hits = 0
    precisions = []
    recommended_ever: set[str] = set()

    for ticket in test_tickets:
        skus = {row.sku for row in ticket}
        for seed in skus:
            truth = skus - {seed}
            if not truth:
                continue
            pool = [sku for sku in catalog_skus if sku != seed]
            recs = random_generator.sample(pool, k=min(k, len(pool)))
            recommended_ever.update(recs)
            hit_items = set(recs) & truth
            hits += 1 if hit_items else 0
            precisions.append(len(hit_items) / k if recs else 0.0)

    n_queries = len(precisions)
    coverage = len(recommended_ever) / len(catalog_skus) if catalog_skus else 0.0
    return StrategyResult(
        name="",
        n_queries=n_queries,
        n_hits=hits,
        hit_rate=round(hits / n_queries, 4) if n_queries else 0.0,
        precision=round(sum(precisions) / n_queries, 4) if n_queries else 0.0,
        coverage=round(coverage, 4),
    )


def _group(sales: list[SaleRow]) -> dict[str, list[SaleRow]]:
    tickets: dict[str, list[SaleRow]] = {}
    for row in sales:
        tickets.setdefault(row.ticket_id, []).append(row)
    return tickets


def _group_by_store(sales: list[SaleRow]) -> dict[int, list[SaleRow]]:
    by_store: dict[int, list[SaleRow]] = {}
    for row in sales:
        by_store.setdefault(row.store_id, []).append(row)
    return by_store
