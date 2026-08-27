"""CSV loaders for products.csv and sales.csv.

Both files ship with the repository root. The loader is strict: any
structural problem (missing column, unparsable number) raises instead of
silently producing bad seed data.
"""

import csv
from datetime import date
from pathlib import Path

from backend.app.domain.entities import Product, SaleRow

PRODUCT_COLUMNS = [
    "sku",
    "nombre",
    "descripcion",
    "categoria",
    "material",
    "uso_recomendado",
    "precio",
    "stock",
]
SALE_COLUMNS = ["ticket_id", "sku", "cantidad", "tienda", "fecha"]


def load_products(path: Path) -> list[Product]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError(f"products.csv vacío: {path}")
    for required in PRODUCT_COLUMNS:
        if required not in rows[0]:
            raise ValueError(f"Columna faltante en products.csv: {required}")

    products = []
    for row in rows:
        products.append(
            Product(
                sku=row["sku"].strip(),
                nombre=row["nombre"].strip(),
                descripcion=row["descripcion"].strip(),
                categoria=row["categoria"].strip(),
                material=row["material"].strip(),
                uso_recomendado=row["uso_recomendado"].strip(),
                precio=int(row["precio"]),
                stock=int(row["stock"]),
            )
        )
    return products


def load_sales(path: Path, store_name_to_id: dict[str, int]) -> list[SaleRow]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError(f"sales.csv vacío: {path}")
    for required in SALE_COLUMNS:
        if required not in rows[0]:
            raise ValueError(f"Columna faltante en sales.csv: {required}")

    sales = []
    for row in rows:
        tienda = row["tienda"].strip()
        if tienda not in store_name_to_id:
            raise ValueError(f"Tienda desconocida en sales.csv: {tienda}")
        sales.append(
            SaleRow(
                ticket_id=row["ticket_id"].strip(),
                sku=row["sku"].strip(),
                store_id=store_name_to_id[tienda],
                cantidad=int(row["cantidad"]),
                fecha=date.fromisoformat(row["fecha"].strip()),
            )
        )
    return sales
