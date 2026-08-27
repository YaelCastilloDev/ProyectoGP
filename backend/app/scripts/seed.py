"""Seed the database with the CSV catalog and sales history.

Usage (from the repo root):
    uv run python -m backend.app.scripts.seed

The script is idempotent: it wipes data tables and reloads everything.
The five stores are created in a fixed order; Mérida has no sales
history in the CSV (cold start, on purpose).
"""

import asyncio

from tortoise import Tortoise

from backend.app.config import get_settings
from backend.app.infrastructure.db.tortoise_models import (
    BlendWeights,
    Product,
    RecommendationRule,
    Sale,
    Store,
)
from backend.app.infrastructure.seeding.csv_loader import load_products, load_sales

STORE_NAMES = ["Cancún", "Chihuahua", "CDMX", "Monterrey", "Mérida"]


async def seed(settings) -> dict:
    await Tortoise.init(
        db_url=settings.db_url,
        modules={"models": ["backend.app.infrastructure.db.tortoise_models"]},
        _enable_global_fallback=True,
    )
    await Tortoise.generate_schemas(safe=True)

    await Sale.all().delete()
    await RecommendationRule.all().delete()
    await BlendWeights.all().delete()
    await Product.all().delete()
    await Store.all().delete()

    store_name_to_id: dict[str, int] = {}
    for nombre in STORE_NAMES:
        model = await Store.create(nombre=nombre)
        store_name_to_id[nombre] = model.id

    products = load_products(settings.products_csv)
    await Product.bulk_create([Product(**p.model_dump()) for p in products])

    sales = load_sales(settings.sales_csv, store_name_to_id)
    await Sale.bulk_create(
        [
            Sale(
                ticket_id=row.ticket_id,
                product_id=row.sku,
                store_id=row.store_id,
                cantidad=row.cantidad,
                fecha=row.fecha,
            )
            for row in sales
        ]
    )

    await Tortoise.close_connections()
    return {
        "stores": len(store_name_to_id),
        "products": len(products),
        "sales": len(sales),
    }


def main() -> None:
    settings = get_settings()
    summary = asyncio.run(seed(settings))
    print("Seed completado:")
    for key, value in summary.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
