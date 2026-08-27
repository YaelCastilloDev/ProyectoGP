"""Store listing (the chain's five stores)."""

from fastapi import APIRouter, Depends

from backend.app.api.deps import get_store_repo
from backend.app.api.schemas import StoreOut
from backend.app.infrastructure.repositories.store_repo import TortoiseStoreRepository

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("", response_model=list[StoreOut])
async def list_stores(repo: TortoiseStoreRepository = Depends(get_store_repo)):
    return await repo.list_all()
