"""Unit tests for the hybrid engine: ranking, rules, stock filter."""

from datetime import date

from backend.app.domain.entities import (
    BlendWeights,
    Product,
    RecommendationRule,
    SaleRow,
)
from backend.app.domain.services.recommender.content import ContentSimilarity
from backend.app.domain.services.recommender.cooccurrence import CooccurrenceSimilarity
from backend.app.domain.services.recommender.engine import RecommenderEngine
from backend.app.domain.services.recommender.popularity import PopularityModel


def make_product(
    sku: str, nombre: str, categoria: str, material: str, uso: str, stock: int = 10
) -> Product:
    return Product(
        sku=sku,
        nombre=nombre,
        descripcion="",
        categoria=categoria,
        material=material,
        uso_recomendado=uso,
        precio=10,
        stock=stock,
    )


def make_engine(products, sales, rules=None, weights=None):
    return RecommenderEngine(
        products=products,
        content=ContentSimilarity(products),
        cooccurrence=CooccurrenceSimilarity(sales),
        popularity=PopularityModel(sales),
        rules=rules or [],
        weights=weights or BlendWeights(store_id=1),
    )


PRODUCTS = [
    make_product("A", "Taladro", "herramienta eléctrica", "acero", "perforación"),
    make_product("B", "Broca concreto", "consumible", "widia", "perforación de concreto"),
    make_product("C", "Pintura", "pintura", "vinil", "interior"),
    make_product("D", "Agotado", "pintura", "vinil", "interior", stock=0),
]

SALES = [
    SaleRow(ticket_id="T1", sku="A", store_id=1, cantidad=1, fecha=date(2026, 1, 1)),
    SaleRow(ticket_id="T1", sku="B", store_id=1, cantidad=2, fecha=date(2026, 1, 1)),
    SaleRow(ticket_id="T2", sku="A", store_id=1, cantidad=1, fecha=date(2026, 1, 2)),
    SaleRow(ticket_id="T2", sku="B", store_id=1, cantidad=1, fecha=date(2026, 1, 2)),
]


def test_excludes_seed_and_out_of_stock():
    engine = make_engine(PRODUCTS, SALES)
    results = engine.recommend(["A"], store_id=1, limit=10)
    skus = {rec.sku for rec in results}
    assert "A" not in skus
    assert "D" not in skus


def test_co_bought_and_similar_product_ranks_first():
    engine = make_engine(PRODUCTS, SALES)
    results = engine.recommend(["A"], store_id=1, limit=5)
    assert results[0].sku == "B"


def test_block_rule_removes_target():
    engine = make_engine(
        PRODUCTS,
        SALES,
        rules=[RecommendationRule(source_sku="A", target_sku="B", action="block")],
    )
    results = engine.recommend(["A"], store_id=1, limit=10)
    assert "B" not in {rec.sku for rec in results}


def test_block_without_source_blocks_everywhere():
    engine = make_engine(
        PRODUCTS,
        SALES,
        rules=[RecommendationRule(source_sku=None, target_sku="B", action="block")],
    )
    results = engine.recommend(["C"], store_id=1, limit=10)
    assert "B" not in {rec.sku for rec in results}


def test_boost_rule_multiplies_score():
    engine = make_engine(
        PRODUCTS,
        SALES,
        rules=[RecommendationRule(source_sku="A", target_sku="C", action="boost", weight=10.0)],
    )
    results = engine.recommend(["A"], store_id=1, limit=5)
    assert results[0].sku == "C"
    assert results[0].rule_boost == 10.0


def test_store_scoped_rule_only_applies_to_its_store():
    engine = make_engine(
        PRODUCTS,
        SALES,
        rules=[RecommendationRule(store_id=2, source_sku="A", target_sku="B", action="block")],
    )
    assert "B" not in {r.sku for r in engine.recommend(["A"], store_id=2, limit=10)}
    assert "B" in {r.sku for r in engine.recommend(["A"], store_id=1, limit=10)}


def test_cart_with_multiple_seeds():
    engine = make_engine(PRODUCTS, SALES)
    results = engine.recommend(["A", "C"], store_id=1, limit=10)
    skus = {rec.sku for rec in results}
    assert "A" not in skus and "C" not in skus
    assert "B" in skus


def test_recommendation_carries_score_decomposition():
    engine = make_engine(PRODUCTS, SALES)
    results = engine.recommend(["A"], store_id=1, limit=5)
    for rec in results:
        assert rec.score > 0
        assert rec.content >= 0 and rec.cooccurrence >= 0 and rec.popularity >= 0
        assert rec.reasons
