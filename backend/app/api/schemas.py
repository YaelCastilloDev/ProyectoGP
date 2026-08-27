"""Pydantic request/response schemas exposed over HTTP."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from backend.app.domain.entities import Recommendation


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=32)
    nombre: str = Field(min_length=1, max_length=160)
    descripcion: str = ""
    categoria: str = Field(min_length=1, max_length=64)
    material: str = ""
    uso_recomendado: str = ""
    precio: int = Field(ge=0)
    stock: int = Field(ge=0)


class ProductUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=160)
    descripcion: str | None = None
    categoria: str | None = Field(default=None, min_length=1, max_length=64)
    material: str | None = None
    uso_recomendado: str | None = None
    precio: int | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)


class ProductOut(ProductCreate):
    pass


class StoreOut(BaseModel):
    id: int
    nombre: str


class StoreCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=64)


class SaleOut(BaseModel):
    ticket_id: str
    sku: str
    nombre: str
    cantidad: int
    precio_unitario: int
    subtotal: int
    fecha: date


class PurchaseItemIn(BaseModel):
    sku: str = Field(min_length=1, max_length=32)
    cantidad: int = Field(gt=0)


class PurchaseIn(BaseModel):
    items: list[PurchaseItemIn] = Field(min_length=1)


class PurchaseLineOut(BaseModel):
    sku: str
    nombre: str
    cantidad: int
    precio_unitario: int
    subtotal: int


class PurchaseOut(BaseModel):
    ticket_id: str
    store_id: int
    fecha: date
    items: list[PurchaseLineOut]
    total: int


class RecommendationOut(Recommendation):
    pass


class RecommendationResponse(BaseModel):
    store_id: int
    seeds: list[str]
    limit: int
    items: list[RecommendationOut]
    weights_used: dict[str, float]


class PairExplanation(BaseModel):
    source_sku: str
    target_sku: str
    content_similarity: float
    cooccurrence_similarity: float
    support_tickets: int
    lift: float
    popularity_score: float
    applicable_rules: list[dict]


class RuleCreate(BaseModel):
    store_id: int | None = None
    source_sku: str | None = None
    target_sku: str = Field(min_length=1, max_length=32)
    action: Literal["boost", "block"]
    weight: float = Field(default=1.0, gt=0)
    note: str = ""


class RuleOut(BaseModel):
    id: int
    store_id: int | None
    source_sku: str | None
    target_sku: str
    target_nombre: str
    action: Literal["boost", "block"]
    weight: float
    note: str


class WeightsOut(BaseModel):
    store_id: int
    w_cooccurrence: float = Field(ge=0)
    w_content: float = Field(ge=0)
    w_popularity: float = Field(ge=0)


class WeightsUpdate(BaseModel):
    w_cooccurrence: float = Field(ge=0)
    w_content: float = Field(ge=0)
    w_popularity: float = Field(ge=0)


class DiscoveredPairsOut(BaseModel):
    cooccurrence: list[dict]
    content: list[dict]


class SaleHistoryOut(BaseModel):
    store_id: int
    total: int
    limit: int
    offset: int
    rows: list[SaleOut]


class SaleImportRow(BaseModel):
    ticket_id: str = Field(min_length=1, max_length=32)
    sku: str = Field(min_length=1, max_length=32)
    cantidad: int = Field(gt=0)
    fecha: date


class SaleImportIn(BaseModel):
    rows: list[SaleImportRow] = Field(min_length=1)


class SaleImportOut(BaseModel):
    imported: int
