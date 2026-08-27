"""Inventory business rules.

Invariant: stock can never go below zero, regardless of which store is buying.

`plan_deductions` is the pure rule: given current stock levels and the
requested lines it either produces the new stock levels or raises. The
persistence layer enforces the same invariant atomically at the database
level (conditional UPDATE), so the rule holds even under concurrency.
"""

from backend.app.domain.entities import PurchaseItem
from backend.app.domain.errors import InsufficientStock


def plan_deductions(stock_by_sku: dict[str, int], items: list[PurchaseItem]) -> dict[str, int]:
    """Return the post-purchase stock levels or raise InsufficientStock."""
    required: dict[str, int] = {}
    for item in items:
        required[item.sku] = required.get(item.sku, 0) + item.cantidad

    for sku, qty in required.items():
        available = stock_by_sku.get(sku, 0)
        if available < qty:
            raise InsufficientStock(sku=sku, requested=qty, available=available)

    return {sku: stock_by_sku[sku] - qty for sku, qty in required.items()}
