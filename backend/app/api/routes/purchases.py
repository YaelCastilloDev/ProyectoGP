"""Purchase flow: a store sells from the shared inventory.

POST /stores/{store_id}/purchases accepts a multi-line ticket. The whole
ticket is all-or-nothing: if any line cannot be satisfied by the shared
inventory the request fails with 409 and nothing is persisted.
"""

from fastapi import APIRouter, Depends

from backend.app.api.deps import get_purchase_service
from backend.app.api.schemas import PurchaseIn, PurchaseOut
from backend.app.domain.entities import PurchaseItem
from backend.app.domain.services.purchasing import PurchaseService
from backend.app.telemetry import traced

router = APIRouter(tags=["purchases"])


@router.post("/stores/{store_id}/purchases", response_model=PurchaseOut, status_code=201)
@traced("purchase.create")
async def create_purchase(
    store_id: int,
    payload: PurchaseIn,
    service: PurchaseService = Depends(get_purchase_service),
):
    items = [PurchaseItem(**item.model_dump()) for item in payload.items]
    receipt = await service.create_purchase(store_id, items)
    return PurchaseOut(**receipt.model_dump())
