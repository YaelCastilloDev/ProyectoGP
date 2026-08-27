"""Unit tests for inventory rules and purchase orchestration."""

import pytest

from backend.app.domain.entities import Product, PurchaseItem
from backend.app.domain.errors import (
    EmptyPurchase,
    InsufficientStock,
    ProductNotFound,
    StoreNotFound,
)
from backend.app.domain.services.inventory import plan_deductions
from backend.app.domain.services.purchasing import PurchaseService


def test_plan_deductions_ok():
    result = plan_deductions(
        {"A": 10, "B": 5}, [PurchaseItem(sku="A", cantidad=3), PurchaseItem(sku="B", cantidad=5)]
    )
    assert result == {"A": 7, "B": 0}


def test_plan_deductions_insufficient():
    with pytest.raises(InsufficientStock) as exc_info:
        plan_deductions({"A": 2}, [PurchaseItem(sku="A", cantidad=3)])
    assert exc_info.value.available == 2


def test_plan_deductions_unknown_sku_is_insufficient():
    with pytest.raises(InsufficientStock):
        plan_deductions({"A": 2}, [PurchaseItem(sku="NOPE", cantidad=1)])


def test_purchase_consolidates_lines():
    service = PurchaseService(object(), object(), object())
    lines = service._consolidate(
        [
            PurchaseItem(sku="A", cantidad=1),
            PurchaseItem(sku="A", cantidad=2),
            PurchaseItem(sku="B", cantidad=1),
        ]
    )
    assert len(lines) == 2
    quantities = {line.sku: line.cantidad for line in lines}
    assert quantities == {"A": 3, "B": 1}


class FakeProducts:
    def __init__(self, products):
        self.products = {p.sku: p for p in products}

    async def get(self, sku):
        return self.products.get(sku)


class FakeStores:
    def __init__(self, store_ids):
        self.store_ids = set(store_ids)

    async def get(self, store_id):
        return object() if store_id in self.store_ids else None


class FakePurchases:
    def __init__(self):
        self.calls = []

    async def execute(self, store_id, ticket_id, fecha, lines):
        self.calls.append(lines)


def make_service(store_ids=("1",), products=None):
    return PurchaseService(
        FakeProducts(products or []),
        FakeStores({int(s) for s in store_ids}),
        FakePurchases(),
    )


async def test_purchase_empty_raises():
    service = make_service()
    with pytest.raises(EmptyPurchase):
        await service.create_purchase(1, [])


async def test_purchase_unknown_store():
    service = make_service(store_ids=("1",))
    with pytest.raises(StoreNotFound):
        await service.create_purchase(99, [PurchaseItem(sku="A", cantidad=1)])


async def test_purchase_unknown_product():
    service = make_service(
        products=[
            Product(
                sku="A",
                nombre="A",
                descripcion="",
                categoria="c",
                material="m",
                uso_recomendado="u",
                precio=1,
                stock=5,
            )
        ]
    )
    with pytest.raises(ProductNotFound):
        await service.create_purchase(1, [PurchaseItem(sku="NOPE", cantidad=1)])


async def test_purchase_insufficient_rolls_back_before_persistence():
    products = [
        Product(
            sku="A",
            nombre="A",
            descripcion="",
            categoria="c",
            material="m",
            uso_recomendado="u",
            precio=1,
            stock=2,
        )
    ]
    purchases = FakePurchases()
    service = PurchaseService(FakeProducts(products), FakeStores({1}), purchases)
    with pytest.raises(InsufficientStock):
        await service.create_purchase(1, [PurchaseItem(sku="A", cantidad=3)])
    assert purchases.calls == []
