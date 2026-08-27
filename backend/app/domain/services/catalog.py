"""Catalog business rules: product lifecycle (create/read/update/delete)."""

from backend.app.domain.entities import Product
from backend.app.domain.errors import DuplicateSku, ProductNotFound
from backend.app.domain.ports import ProductRepository


class CatalogService:
    def __init__(self, products: ProductRepository) -> None:
        self.products = products

    async def get(self, sku: str) -> Product:
        product = await self.products.get(sku)
        if product is None:
            raise ProductNotFound(sku)
        return product

    async def list(self) -> list[Product]:
        return await self.products.list_all()

    async def create(self, data: dict) -> Product:
        if await self.products.get(data["sku"]) is not None:
            raise DuplicateSku(data["sku"])
        product = Product.model_validate(data)
        return await self.products.create(product)

    async def update(self, sku: str, changes: dict) -> Product:
        if await self.products.get(sku) is None:
            raise ProductNotFound(sku)
        updated = await self.products.update(sku, **changes)
        if updated is None:  # pragma: no cover - defensive
            raise ProductNotFound(sku)
        return updated

    async def delete(self, sku: str) -> None:
        if not await self.products.delete(sku):
            raise ProductNotFound(sku)
