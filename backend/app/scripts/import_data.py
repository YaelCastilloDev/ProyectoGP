"""Import products.csv and sales.csv through the business HTTP endpoints.

Usage (server running first):
    uv run python -m backend.app.scripts.import_data

The script drives the real API (POST /api/products, POST /api/stores,
POST /api/stores/{id}/sales/import) instead of touching the database.
Idempotent: products that already exist (409) and tickets already imported
are skipped, so re-running is safe.

This is the business-aligned alternative to the seed CLI, which writes
directly to SQLite.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict

import httpx

from backend.app.config import get_settings
from backend.app.infrastructure.seeding.csv_loader import load_products, load_sales
from backend.app.scripts.seed import STORE_NAMES


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000", help="URL base del API")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    settings = get_settings()

    try:
        health = httpx.get(f"{args.base_url}/api/health", timeout=10.0)
    except httpx.HTTPError:
        print("ERROR: no se pudo conectar con la API.", file=sys.stderr)
        print(
            f"  Arranca primero: uv run uvicorn backend.app.main:app --reload  ({args.base_url})",
            file=sys.stderr,
        )
        return 1
    if health.status_code != 200:
        print(f"ERROR: /api/health respondio {health.status_code}", file=sys.stderr)
        return 1

    stores = httpx.get(f"{args.base_url}/api/stores", timeout=10.0).json()
    store_name_to_id = {store["nombre"]: store["id"] for store in stores}

    created_stores = 0
    for nombre in STORE_NAMES:
        if nombre in store_name_to_id:
            continue
        response = httpx.post(f"{args.base_url}/api/stores", json={"nombre": nombre}, timeout=10.0)
        if response.status_code != 201:
            print(
                f"ERROR creando tienda {nombre}: {response.status_code} {response.text}",
                file=sys.stderr,
            )
            return 1
        store_name_to_id[nombre] = response.json()["id"]
        created_stores += 1

    created_products = 0
    skipped_products = 0
    for product in load_products(settings.products_csv):
        response = httpx.post(
            f"{args.base_url}/api/products", json=product.model_dump(), timeout=10.0
        )
        if response.status_code == 201:
            created_products += 1
        elif response.status_code == 409:
            skipped_products += 1
        else:
            print(
                f"ERROR creando {product.sku}: {response.status_code} {response.text}",
                file=sys.stderr,
            )
            return 1

    sales = load_sales(settings.sales_csv, store_name_to_id)
    by_store: dict[int, list[dict]] = defaultdict(list)
    for row in sales:
        by_store[row.store_id].append(
            {
                "ticket_id": row.ticket_id,
                "sku": row.sku,
                "cantidad": row.cantidad,
                "fecha": row.fecha.isoformat(),
            }
        )

    imported = 0
    for store_id, rows in by_store.items():
        response = httpx.post(
            f"{args.base_url}/api/stores/{store_id}/sales/import",
            json={"rows": rows},
            timeout=60.0,
        )
        if response.status_code != 201:
            print(
                f"ERROR importando ventas de la tienda {store_id}: "
                f"{response.status_code} {response.text}",
                file=sys.stderr,
            )
            return 1
        imported += response.json()["imported"]

    print("Importacion completada via API:")
    print(f"  tiendas creadas: {created_stores}")
    print(f"  productos creados: {created_products} (ya existian: {skipped_products})")
    print(f"  filas de venta importadas: {imported} (ya registradas: {len(sales) - imported})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
