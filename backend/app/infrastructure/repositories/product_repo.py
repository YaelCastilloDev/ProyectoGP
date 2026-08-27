"""Tortoise implementation of ProductRepository."""

from backend.app.domain.entities import Product
from backend.app.infrastructure.db.tortoise_models import Product as ProductModel


class TortoiseProductRepository:
    async def get(self, sku: str) -> Product | None:
        model = await ProductModel.filter(sku=sku).first()
        return Product.model_validate(model) if model else None

    async def list_all(self) -> list[Product]:
        models = await ProductModel.all()
        return [Product.model_validate(model) for model in models]

    async def create(self, product: Product) -> Product:
        await ProductModel.create(**product.model_dump())
        return product

    async def update(self, sku: str, **changes) -> Product | None:
        model = await ProductModel.filter(sku=sku).first()
        if model is None:
            return None
        model.update_from_dict(changes)
        await model.save()
        return Product.model_validate(model)

    async def delete(self, sku: str) -> bool:
        deleted = await ProductModel.filter(sku=sku).delete()
        return deleted > 0
