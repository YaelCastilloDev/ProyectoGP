"""Repository ports (interfaces) implemented by the infrastructure layer.

The domain only depends on these protocols; Tortoise-ORM sits behind them.
"""

from typing import Protocol

from backend.app.domain.entities import (
    BlendWeights,
    Product,
    RecommendationRule,
    SaleRow,
    Store,
)


class ProductRepository(Protocol):
    async def get(self, sku: str) -> Product | None: ...

    async def list_all(self) -> list[Product]: ...

    async def create(self, product: Product) -> Product: ...

    async def update(self, sku: str, **changes) -> Product | None: ...

    async def delete(self, sku: str) -> bool: ...


class StoreRepository(Protocol):
    async def get(self, store_id: int) -> Store | None: ...

    async def get_by_name(self, nombre: str) -> Store | None: ...

    async def list_all(self) -> list[Store]: ...

    async def create(self, nombre: str) -> Store: ...


class SaleRepository(Protocol):
    async def list_rows(
        self, store_id: int | None = None, limit: int = 200, offset: int = 0
    ) -> list[SaleRow]: ...

    async def all_rows(self) -> list[SaleRow]: ...


class PurchaseRepository(Protocol):
    """Persists a whole ticket atomically, enforcing the shared-inventory rule.

    The implementation MUST run inside a single database transaction:
    every line deducts stock with a conditional UPDATE (`stock >= qty`) and,
    if any line cannot be satisfied, the whole purchase fails and nothing is
    persisted. This is what makes the "inventory is never oversold" rule hold
    under concurrent purchases from different stores.
    """

    async def execute(self, store_id: int, ticket_id: str, fecha, lines) -> None:
        """Raise InsufficientStock and persist nothing if any line is short."""
        ...


class RuleRepository(Protocol):
    async def list_all(self) -> list[RecommendationRule]: ...

    async def create(self, rule: RecommendationRule) -> RecommendationRule: ...

    async def delete(self, rule_id: int) -> bool: ...

    async def get_weights(self, store_id: int) -> BlendWeights: ...

    async def set_weights(self, store_id: int, weights: BlendWeights) -> BlendWeights: ...
