"""Store listing (the chain's five stores) and store onboarding."""

from fastapi import APIRouter, Depends

from backend.app.api.deps import get_store_repo
from backend.app.api.schemas import StoreCreate, StoreOut
from backend.app.domain.errors import DuplicateStore
from backend.app.infrastructure.repositories.store_repo import TortoiseStoreRepository

router = APIRouter(prefix="/stores", tags=["stores"])


@router.get("", response_model=list[StoreOut])
async def list_stores(repo: TortoiseStoreRepository = Depends(get_store_repo)):
    return await repo.list_all()


@router.post("", response_model=StoreOut, status_code=201)
async def create_store(
    payload: StoreCreate, repo: TortoiseStoreRepository = Depends(get_store_repo)
):
    if await repo.get_by_name(payload.nombre) is not None:
        raise DuplicateStore(payload.nombre)
    return await repo.create(payload.nombre)
