"""Sales history per store, plus history import (store onboarding)."""

from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import get_product_repo, get_sale_repo, get_store_repo
from backend.app.api.schemas import (
    SaleHistoryOut,
    SaleImportIn,
    SaleImportOut,
    SaleOut,
)
from backend.app.domain.entities import SaleRow
from backend.app.domain.errors import StoreNotFound
from backend.app.domain.services.sales_history import SalesHistoryService
from backend.app.infrastructure.repositories.product_repo import TortoiseProductRepository
from backend.app.infrastructure.repositories.sale_repo import TortoiseSaleRepository
from backend.app.infrastructure.repositories.store_repo import TortoiseStoreRepository

router = APIRouter(tags=["sales"])


@router.get("/stores/{store_id}/sales", response_model=SaleHistoryOut)
async def list_sales(
    store_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    stores: TortoiseStoreRepository = Depends(get_store_repo),
    sales: TortoiseSaleRepository = Depends(get_sale_repo),
    products: TortoiseProductRepository = Depends(get_product_repo),
):
    if await stores.get(store_id) is None:
        raise StoreNotFound(store_id)

    rows = await sales.list_rows(store_id=store_id, limit=limit, offset=offset)
    skus = {row.sku for row in rows}
    catalog = {product.sku: product for product in await products.list_all() if product.sku in skus}

    enriched = [
        SaleOut(
            ticket_id=row.ticket_id,
            sku=row.sku,
            nombre=catalog[row.sku].nombre if row.sku in catalog else row.sku,
            cantidad=row.cantidad,
            precio_unitario=catalog[row.sku].precio if row.sku in catalog else 0,
            subtotal=row.cantidad * (catalog[row.sku].precio if row.sku in catalog else 0),
            fecha=row.fecha,
        )
        for row in rows
    ]
    return SaleHistoryOut(
        store_id=store_id, total=len(enriched), limit=limit, offset=offset, rows=enriched
    )


@router.post("/stores/{store_id}/sales/import", response_model=SaleImportOut, status_code=201)
async def import_sales_history(
    store_id: int,
    payload: SaleImportIn,
    stores: TortoiseStoreRepository = Depends(get_store_repo),
    products: TortoiseProductRepository = Depends(get_product_repo),
    sales: TortoiseSaleRepository = Depends(get_sale_repo),
):
    """Import a store's historical tickets. Insert-only: never touches stock."""
    service = SalesHistoryService(stores, products, sales)
    rows = [
        SaleRow(
            ticket_id=row.ticket_id,
            sku=row.sku,
            store_id=store_id,
            cantidad=row.cantidad,
            fecha=row.fecha,
        )
        for row in payload.rows
    ]
    imported = await service.import_rows(store_id, rows)
    return SaleImportOut(imported=imported)
