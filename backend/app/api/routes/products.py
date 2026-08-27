"""Product CRUD."""

from fastapi import APIRouter, Depends

from backend.app.api.deps import get_catalog_service
from backend.app.api.schemas import ProductCreate, ProductOut, ProductUpdate
from backend.app.domain.services.catalog import CatalogService

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
async def list_products(service: CatalogService = Depends(get_catalog_service)):
    return await service.list()


@router.get("/{sku}", response_model=ProductOut)
async def get_product(sku: str, service: CatalogService = Depends(get_catalog_service)):
    return await service.get(sku)


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(
    payload: ProductCreate, service: CatalogService = Depends(get_catalog_service)
):
    return await service.create(payload.model_dump())


@router.patch("/{sku}", response_model=ProductOut)
async def update_product(
    sku: str,
    payload: ProductUpdate,
    service: CatalogService = Depends(get_catalog_service),
):
    changes = payload.model_dump(exclude_unset=True)
    return await service.update(sku, changes)


@router.delete("/{sku}", status_code=204)
async def delete_product(sku: str, service: CatalogService = Depends(get_catalog_service)):
    await service.delete(sku)
