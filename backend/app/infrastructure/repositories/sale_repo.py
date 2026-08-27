"""Tortoise implementation of SaleRepository."""

from backend.app.domain.entities import SaleRow
from backend.app.infrastructure.db.tortoise_models import Sale as SaleModel


class TortoiseSaleRepository:
    async def list_rows(
        self, store_id: int | None = None, limit: int = 200, offset: int = 0
    ) -> list[SaleRow]:
        query = SaleModel.all().order_by("-fecha", "-id")
        if store_id is not None:
            query = query.filter(store_id=store_id)
        models = await query.limit(limit).offset(offset).prefetch_related("product", "store")
        return [self._to_row(model) for model in models]

    async def all_rows(self) -> list[SaleRow]:
        models = await SaleModel.all()
        return [self._to_row(model) for model in models]

    @staticmethod
    def _to_row(model) -> SaleRow:
        return SaleRow(
            ticket_id=model.ticket_id,
            sku=model.product_id,
            store_id=model.store_id,
            cantidad=model.cantidad,
            fecha=model.fecha,
        )
