"""Purchase flow: atomicity and the no-oversell invariant."""

import asyncio

from backend.app.domain.entities import PurchaseItem
from backend.app.domain.services.purchasing import PurchaseService
from backend.app.infrastructure.repositories.product_repo import TortoiseProductRepository
from backend.app.infrastructure.repositories.purchase_repo import TortoisePurchaseRepository
from backend.app.infrastructure.repositories.store_repo import TortoiseStoreRepository


async def test_purchase_happy_path(client):
    before = (await client.get("/api/products/P1")).json()["stock"]
    response = await client.post(
        "/api/stores/1/purchases",
        json={"items": [{"sku": "P1", "cantidad": 2}]},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["total"] == 200
    assert body["items"][0]["subtotal"] == 200
    after = (await client.get("/api/products/P1")).json()["stock"]
    assert after == before - 2

    sales = (await client.get("/api/stores/1/sales")).json()["rows"]
    assert any(row["ticket_id"] == body["ticket_id"] for row in sales)


async def test_purchase_consolidates_repeated_skus(client):
    response = await client.post(
        "/api/stores/1/purchases",
        json={"items": [{"sku": "P1", "cantidad": 1}, {"sku": "P1", "cantidad": 1}]},
    )
    assert response.status_code == 201
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["cantidad"] == 2
    assert (await client.get("/api/products/P1")).json()["stock"] == 8


async def test_purchase_insufficient_stock(client):
    before = (await client.get("/api/products/P1")).json()["stock"]
    response = await client.post(
        "/api/stores/1/purchases",
        json={"items": [{"sku": "P1", "cantidad": 999}]},
    )
    assert response.status_code == 409
    after = (await client.get("/api/products/P1")).json()["stock"]
    assert after == before


async def test_purchase_all_or_nothing(client):
    """If any line fails, no line is sold."""
    before_p1 = (await client.get("/api/products/P1")).json()["stock"]
    before_p4 = (await client.get("/api/products/P4")).json()["stock"]
    response = await client.post(
        "/api/stores/1/purchases",
        json={
            "items": [
                {"sku": "P1", "cantidad": 1},
                {"sku": "P4", "cantidad": 999},
            ]
        },
    )
    assert response.status_code == 409
    assert (await client.get("/api/products/P1")).json()["stock"] == before_p1
    assert (await client.get("/api/products/P4")).json()["stock"] == before_p4


async def test_purchase_unknown_store_and_product(client):
    missing_store = await client.post(
        "/api/stores/99/purchases", json={"items": [{"sku": "P1", "cantidad": 1}]}
    )
    assert missing_store.status_code == 404

    missing_product = await client.post(
        "/api/stores/1/purchases", json={"items": [{"sku": "NOPE", "cantidad": 1}]}
    )
    assert missing_product.status_code == 404


async def test_purchase_empty_items_rejected(client):
    response = await client.post("/api/stores/1/purchases", json={"items": []})
    assert response.status_code == 422


async def test_concurrent_purchases_never_oversell(client):
    """P4 has stock 3; 20 concurrent single-unit purchases: exactly 3 succeed."""
    service = PurchaseService(
        TortoiseProductRepository(), TortoiseStoreRepository(), TortoisePurchaseRepository()
    )

    async def buy_one():
        try:
            await service.create_purchase(2, [PurchaseItem(sku="P4", cantidad=1)])
            return 201
        except Exception:
            return 409

    results = await asyncio.gather(*[buy_one() for _ in range(20)])
    assert results.count(201) == 3
    assert results.count(409) == 17
    stock = (await client.get("/api/products/P4")).json()["stock"]
    assert stock == 0
