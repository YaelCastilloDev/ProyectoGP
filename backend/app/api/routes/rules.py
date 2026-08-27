"""Relationship manager: the business sees and adjusts what the system learns.

- GET  /rules                    list explicit rules (boosts/blocks)
- POST /rules                    create a rule (global or per store)
- DELETE /rules/{rule_id}        remove a rule
- GET  /rules/discovered         pairs the engine found (lift + content sim)
- GET  /stores/{id}/weights      blend weights of the store
- PUT  /stores/{id}/weights      adjust blend weights of the store
"""

from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import (
    build_recommender_engine,
    get_product_repo,
    get_rule_repo,
    get_store_repo,
)
from backend.app.api.schemas import (
    DiscoveredPairsOut,
    RuleCreate,
    RuleOut,
    WeightsOut,
    WeightsUpdate,
)
from backend.app.domain.entities import BlendWeights, RecommendationRule
from backend.app.domain.errors import ProductNotFound, RuleNotFound, StoreNotFound
from backend.app.infrastructure.repositories.product_repo import TortoiseProductRepository
from backend.app.infrastructure.repositories.rule_repo import TortoiseRuleRepository
from backend.app.infrastructure.repositories.store_repo import TortoiseStoreRepository

router = APIRouter(tags=["rules"])


@router.get("/rules", response_model=list[RuleOut])
async def list_rules(
    rules: TortoiseRuleRepository = Depends(get_rule_repo),
    products: TortoiseProductRepository = Depends(get_product_repo),
):
    all_rules = await rules.list_all()
    catalog = {p.sku: p.nombre for p in await products.list_all()}
    return [
        RuleOut(
            id=rule.id,
            store_id=rule.store_id,
            source_sku=rule.source_sku,
            target_sku=rule.target_sku,
            target_nombre=catalog.get(rule.target_sku, rule.target_sku),
            action=rule.action,
            weight=rule.weight,
            note=rule.note,
        )
        for rule in all_rules
    ]


@router.post("/rules", response_model=RuleOut, status_code=201)
async def create_rule(
    payload: RuleCreate,
    rules: TortoiseRuleRepository = Depends(get_rule_repo),
    stores: TortoiseStoreRepository = Depends(get_store_repo),
    products: TortoiseProductRepository = Depends(get_product_repo),
):
    if payload.store_id is not None and await stores.get(payload.store_id) is None:
        raise StoreNotFound(payload.store_id)
    if payload.source_sku is not None and await products.get(payload.source_sku) is None:
        raise ProductNotFound(payload.source_sku)
    target = await products.get(payload.target_sku)
    if target is None:
        raise ProductNotFound(payload.target_sku)

    rule = await rules.create(RecommendationRule(**payload.model_dump()))
    return RuleOut(
        id=rule.id,
        store_id=rule.store_id,
        source_sku=rule.source_sku,
        target_sku=rule.target_sku,
        target_nombre=target.nombre,
        action=rule.action,
        weight=rule.weight,
        note=rule.note,
    )


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: int, rules: TortoiseRuleRepository = Depends(get_rule_repo)):
    if not await rules.delete(rule_id):
        raise RuleNotFound(rule_id)


@router.get("/rules/discovered", response_model=DiscoveredPairsOut)
async def discovered_pairs(
    store_id: int | None = None,
    min_support: int = Query(default=2, ge=1),
    min_similarity: float = Query(default=0.15, ge=0, le=1),
    limit: int = Query(default=20, ge=1, le=100),
    stores: TortoiseStoreRepository = Depends(get_store_repo),
):
    if store_id is not None and await stores.get(store_id) is None:
        raise StoreNotFound(store_id)
    engine = await build_recommender_engine(store_id or 0)

    cooc_pairs = engine.cooccurrence.ranked_pairs(min_support=min_support)[:limit]

    catalog = engine.products
    content_pairs = []
    skus = sorted(catalog)
    for index, sku in enumerate(skus):
        for other in skus[index + 1 :]:
            similarity = engine.content.similarity(sku, other)
            if similarity >= min_similarity:
                content_pairs.append(
                    {
                        "source_sku": sku,
                        "target_sku": other,
                        "similarity": round(similarity, 4),
                    }
                )
    content_pairs.sort(key=lambda pair: -pair["similarity"])
    content_pairs = content_pairs[:limit]

    return DiscoveredPairsOut(cooccurrence=cooc_pairs, content=content_pairs)


@router.get("/stores/{store_id}/weights", response_model=WeightsOut)
async def get_weights(
    store_id: int,
    stores: TortoiseStoreRepository = Depends(get_store_repo),
    rules: TortoiseRuleRepository = Depends(get_rule_repo),
):
    if await stores.get(store_id) is None:
        raise StoreNotFound(store_id)
    weights = await rules.get_weights(store_id)
    return WeightsOut(**weights.model_dump())


@router.put("/stores/{store_id}/weights", response_model=WeightsOut)
async def set_weights(
    store_id: int,
    payload: WeightsUpdate,
    stores: TortoiseStoreRepository = Depends(get_store_repo),
    rules: TortoiseRuleRepository = Depends(get_rule_repo),
):
    if await stores.get(store_id) is None:
        raise StoreNotFound(store_id)
    saved = await rules.set_weights(
        store_id, BlendWeights(store_id=store_id, **payload.model_dump())
    )
    return WeightsOut(**saved.model_dump())
