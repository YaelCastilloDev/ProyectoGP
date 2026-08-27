"""FastAPI dependencies: repository/service wiring (composition root)."""

from functools import lru_cache

from backend.app.domain.entities import Product
from backend.app.domain.services.catalog import CatalogService
from backend.app.domain.services.purchasing import PurchaseService
from backend.app.domain.services.recommender.content import ContentSimilarity
from backend.app.domain.services.recommender.cooccurrence import CooccurrenceSimilarity
from backend.app.domain.services.recommender.engine import RecommenderEngine
from backend.app.domain.services.recommender.popularity import PopularityModel
from backend.app.infrastructure.repositories.product_repo import TortoiseProductRepository
from backend.app.infrastructure.repositories.purchase_repo import TortoisePurchaseRepository
from backend.app.infrastructure.repositories.rule_repo import TortoiseRuleRepository
from backend.app.infrastructure.repositories.sale_repo import TortoiseSaleRepository
from backend.app.infrastructure.repositories.store_repo import TortoiseStoreRepository


@lru_cache
def get_product_repo() -> TortoiseProductRepository:
    return TortoiseProductRepository()


@lru_cache
def get_store_repo() -> TortoiseStoreRepository:
    return TortoiseStoreRepository()


@lru_cache
def get_sale_repo() -> TortoiseSaleRepository:
    return TortoiseSaleRepository()


@lru_cache
def get_purchase_repo() -> TortoisePurchaseRepository:
    return TortoisePurchaseRepository()


@lru_cache
def get_rule_repo() -> TortoiseRuleRepository:
    return TortoiseRuleRepository()


def get_catalog_service() -> CatalogService:
    return CatalogService(get_product_repo())


def get_purchase_service() -> PurchaseService:
    return PurchaseService(get_product_repo(), get_store_repo(), get_purchase_repo())


async def build_recommender_engine(store_id: int) -> RecommenderEngine:
    """Compose the hybrid engine for one store from current DB state.

    The seed dataset is tiny (28 products, ~200 sale rows) so rebuilding
    the models per request is cheap and always reflects the latest sales
    and rules. At production scale this becomes a cached/incrementally
    updated index (see README).
    """
    products = await get_product_repo().list_all()
    sales = await get_sale_repo().all_rows()
    rules = await get_rule_repo().list_all()
    weights = await get_rule_repo().get_weights(store_id)

    return RecommenderEngine(
        products=products,
        content=ContentSimilarity(products),
        cooccurrence=CooccurrenceSimilarity(sales),
        popularity=PopularityModel(sales),
        rules=rules,
        weights=weights,
    )


async def load_catalog() -> list[Product]:
    return await get_product_repo().list_all()
