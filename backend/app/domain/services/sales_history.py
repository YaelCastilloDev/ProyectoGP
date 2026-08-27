"""Sales history import: onboarding/migration of a store's past tickets.

Business rules:
1. The store must exist.
2. Every SKU must exist in the catalog (validated before persisting anything).
3. Original ticket ids and dates are preserved exactly as provided.
4. The import NEVER touches stock: inventory only moves through purchases.
5. Idempotent per ticket: tickets already registered for the store are skipped.
"""

from backend.app.domain.entities import SaleRow
from backend.app.domain.errors import ProductNotFound, StoreNotFound
from backend.app.domain.ports import ProductRepository, SaleRepository, StoreRepository


class SalesHistoryService:
    def __init__(
        self,
        stores: StoreRepository,
        products: ProductRepository,
        sales: SaleRepository,
    ) -> None:
        self.stores = stores
        self.products = products
        self.sales = sales

    async def import_rows(self, store_id: int, rows: list[SaleRow]) -> int:
        store = await self.stores.get(store_id)
        if store is None:
            raise StoreNotFound(store_id)

        catalog = {product.sku for product in await self.products.list_all()}
        for row in rows:
            if row.sku not in catalog:
                raise ProductNotFound(row.sku)

        existing = await self.sales.existing_ticket_ids(store_id, [row.ticket_id for row in rows])
        new_rows = [row for row in rows if row.ticket_id not in existing]
        if not new_rows:
            return 0
        return await self.sales.bulk_create(new_rows)
