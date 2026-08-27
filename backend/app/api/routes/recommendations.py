"""Recommendation endpoints.

- GET /recommendations: given a cart (one or more SKUs) and a store,
  return top-K suggestions with their score decomposition.
- GET /recommendations/explain: full breakdown for a single source/target
  pair (used by the relationship manager UI).
"""

from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import build_recommender_engine, get_rule_repo, get_store_repo
from backend.app.api.schemas import PairExplanation, RecommendationOut, RecommendationResponse
from backend.app.domain.errors import StoreNotFound
from backend.app.infrastructure.repositories.rule_repo import TortoiseRuleRepository
from backend.app.infrastructure.repositories.store_repo import TortoiseStoreRepository
from backend.app.telemetry import traced

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationResponse)
@traced("recommendations.get")
async def recommend(
    store_id: int,
    cart: str = Query(..., description="SKUs separados por coma, p. ej. SKU001,SKU004"),
    limit: int = Query(default=5, ge=1, le=20),
    stores: TortoiseStoreRepository = Depends(get_store_repo),
):
    if await stores.get(store_id) is None:
        raise StoreNotFound(store_id)
    seeds = [sku.strip() for sku in cart.split(",") if sku.strip()]
    engine = await build_recommender_engine(store_id)
    items = engine.recommend(seeds, store_id, limit=limit)
    return RecommendationResponse(
        store_id=store_id,
        seeds=seeds,
        limit=limit,
        items=[RecommendationOut(**item.model_dump()) for item in items],
        weights_used={
            "w_cooccurrence": engine.weights.w_cooccurrence,
            "w_content": engine.weights.w_content,
            "w_popularity": engine.weights.w_popularity,
        },
    )


@router.get("/explain", response_model=PairExplanation)
async def explain_pair(
    store_id: int,
    source: str = Query(...),
    target: str = Query(...),
    stores: TortoiseStoreRepository = Depends(get_store_repo),
    rules: TortoiseRuleRepository = Depends(get_rule_repo),
):
    if await stores.get(store_id) is None:
        raise StoreNotFound(store_id)
    engine = await build_recommender_engine(store_id)
    applicable = [
        rule.model_dump()
        for rule in engine.rules
        if rule.target_sku == target
        and (rule.source_sku is None or rule.source_sku == source)
        and (rule.store_id is None or rule.store_id == store_id)
    ]
    return PairExplanation(
        source_sku=source,
        target_sku=target,
        content_similarity=round(engine.content.similarity(source, target), 4),
        cooccurrence_similarity=round(engine.cooccurrence.similarity(source, target), 4),
        support_tickets=engine.cooccurrence.support(source, target),
        lift=round(engine.cooccurrence.lift(source, target), 4),
        popularity_score=round(engine.popularity.score(target, store_id), 4),
        applicable_rules=applicable,
    )
