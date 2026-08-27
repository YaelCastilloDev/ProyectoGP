"""Core domain entities.

Plain Pydantic models describing the business concepts independent of
persistence. Prices are integers (whole Mexican pesos) as shipped in the
catalog CSV; this avoids floating point rounding in money arithmetic.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_BLEND_WEIGHTS = {
    "w_cooccurrence": 0.3,
    "w_content": 0.9,
    "w_popularity": 0.1,
}


class Store(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class Product(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sku: str
    nombre: str
    descripcion: str
    categoria: str
    material: str
    uso_recomendado: str
    precio: int = Field(ge=0)
    stock: int = Field(ge=0)


class SaleRow(BaseModel):
    """One line of a sale ticket (historical or new)."""

    model_config = ConfigDict(from_attributes=True)

    ticket_id: str
    sku: str
    store_id: int
    cantidad: int = Field(gt=0)
    fecha: date


class PurchaseItem(BaseModel):
    """Requested line of a purchase."""

    sku: str
    cantidad: int = Field(gt=0)


class PurchaseLine(BaseModel):
    """Realized line of a purchase, with price and subtotal."""

    sku: str
    nombre: str
    cantidad: int
    precio_unitario: int
    subtotal: int


class PurchaseReceipt(BaseModel):
    ticket_id: str
    store_id: int
    fecha: date
    items: list[PurchaseLine]
    total: int


class RecommendationRule(BaseModel):
    """Business-adjustable relationship between products.

    - `source_sku=None` means the rule applies to the target regardless of
      what is being purchased.
    - `store_id=None` means the rule applies to every store.
    - action `boost` multiplies the target's score by `weight`;
      action `block` removes the target from recommendations.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    store_id: int | None = None
    source_sku: str | None = None
    target_sku: str
    action: Literal["boost", "block"]
    weight: float = 1.0
    note: str = ""


class BlendWeights(BaseModel):
    """Per-store weights of the three recommendation signals."""

    model_config = ConfigDict(from_attributes=True)

    store_id: int
    w_cooccurrence: float = DEFAULT_BLEND_WEIGHTS["w_cooccurrence"]
    w_content: float = DEFAULT_BLEND_WEIGHTS["w_content"]
    w_popularity: float = DEFAULT_BLEND_WEIGHTS["w_popularity"]


class Recommendation(BaseModel):
    """A single recommendation with its score decomposition (explainability)."""

    sku: str
    nombre: str
    precio: int
    stock: int
    score: float
    content: float = 0.0
    cooccurrence: float = 0.0
    popularity: float = 0.0
    rule_boost: float = 1.0
    reasons: list[str] = []
