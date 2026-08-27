"""Unit tests for the content-based (TF-IDF) signal."""

import pytest

from backend.app.domain.entities import Product
from backend.app.domain.services.recommender.content import ContentSimilarity


def make_product(sku: str, nombre: str, categoria: str, material: str, uso: str) -> Product:
    return Product(
        sku=sku,
        nombre=nombre,
        descripcion="",
        categoria=categoria,
        material=material,
        uso_recomendado=uso,
        precio=10,
        stock=10,
    )


def test_identical_products_have_similarity_one():
    products = [
        make_product("A", "Taladro", "herramienta eléctrica", "acero", "perforación"),
        make_product("B", "Taladro", "herramienta eléctrica", "acero", "perforación"),
    ]
    model = ContentSimilarity(products)
    assert model.similarity("A", "B") == pytest.approx(1.0)


def test_disjoint_products_have_similarity_zero():
    products = [
        make_product("A", "Taladro", "herramienta eléctrica", "acero", "perforación"),
        make_product("B", "Pintura", "pintura", "vinil acrílico", "interior"),
    ]
    model = ContentSimilarity(products)
    assert model.similarity("A", "B") == 0.0


def test_shared_tokens_rank_higher_than_none():
    a = make_product("A", "Taladro percutor", "herramienta eléctrica", "acero", "perforación")
    similar = make_product("B", "Broca percutor", "consumible", "widia", "perforación de concreto")
    unrelated = make_product("C", "Pintura interior", "pintura", "vinil", "interior")
    model = ContentSimilarity([a, similar, unrelated])
    assert model.similarity("A", "B") > model.similarity("A", "C")


def test_unknown_sku_returns_zero():
    products = [make_product("A", "Taladro", "herramienta", "acero", "perforación")]
    model = ContentSimilarity(products)
    assert model.similarity("A", "NOPE") == 0.0
    assert model.similarity("NOPE", "NOPE") == 0.0
