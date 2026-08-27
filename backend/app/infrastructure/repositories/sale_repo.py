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

    async def existing_ticket_ids(self, store_id: int, ticket_ids: list[str]) -> set[str]:
        models = await SaleModel.filter(store_id=store_id, ticket_id__in=ticket_ids).values_list(
            "ticket_id", flat=True
        )
        return set(models)

    async def bulk_create(self, rows: list[SaleRow]) -> int:
        await SaleModel.bulk_create(
            [
                SaleModel(
                    ticket_id=row.ticket_id,
                    product_id=row.sku,
                    store_id=row.store_id,
                    cantidad=row.cantidad,
                    fecha=row.fecha,
                )
                for row in rows
            ]
        )
        return len(rows)

    @staticmethod
    def _to_row(model) -> SaleRow:
        return SaleRow(
            ticket_id=model.ticket_id,
            sku=model.product_id,
            store_id=model.store_id,
            cantidad=model.cantidad,
            fecha=model.fecha,
        )
