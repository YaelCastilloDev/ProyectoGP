"""Tortoise implementation of StoreRepository."""

from backend.app.domain.entities import Store
from backend.app.infrastructure.db.tortoise_models import Store as StoreModel


class TortoiseStoreRepository:
    async def get(self, store_id: int) -> Store | None:
        model = await StoreModel.filter(id=store_id).first()
        return Store.model_validate(model) if model else None

    async def get_by_name(self, nombre: str) -> Store | None:
        model = await StoreModel.filter(nombre=nombre).first()
        return Store.model_validate(model) if model else None

    async def list_all(self) -> list[Store]:
        models = await StoreModel.all()
        return [Store.model_validate(model) for model in models]

    async def create(self, nombre: str) -> Store:
        model = await StoreModel.create(nombre=nombre)
        return Store.model_validate(model)
