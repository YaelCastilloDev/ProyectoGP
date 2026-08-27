"""Offline evaluation CLI.

Usage (from the repo root):
    uv run python -m backend.app.scripts.evaluate [--split-date 2026-03-05] [--k 5]

Prints the same report served by GET /api/evaluation: an ablation table
per signal plus baselines, coverage and per-store hybrid hit rates.
"""

import argparse
import asyncio
from datetime import date

from tortoise import Tortoise

from backend.app.config import get_settings
from backend.app.domain.entities import Product as DomainProduct
from backend.app.domain.entities import SaleRow
from backend.app.domain.services.evaluation import run_offline_evaluation
from backend.app.infrastructure.db.tortoise_models import Product, Sale


async def evaluate(split_date: date, k: int) -> dict:
    settings = get_settings()
    await Tortoise.init(
        db_url=settings.db_url,
        modules={"models": ["backend.app.infrastructure.db.tortoise_models"]},
        _enable_global_fallback=True,
    )
    products = [DomainProduct.model_validate(p) for p in await Product.all()]
    sales = [
        SaleRow(
            ticket_id=s.ticket_id,
            sku=s.product_id,
            store_id=s.store_id,
            cantidad=s.cantidad,
            fecha=s.fecha,
        )
        for s in await Sale.all()
    ]
    await Tortoise.close_connections()

    report = run_offline_evaluation(products, sales, split_date=split_date, k=k)
    return report.model_dump()


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluación offline del recomendador")
    parser.add_argument("--split-date", default="2026-03-05", help="Fecha de corte (AAAA-MM-DD)")
    parser.add_argument("--k", type=int, default=5, help="Top-K a evaluar")
    args = parser.parse_args()

    report = asyncio.run(evaluate(date.fromisoformat(args.split_date), args.k))

    print(f"Split: {report['split_date']} | K: {report['k']}")
    print(f"Tickets train: {report['n_train_tickets']} | test: {report['n_test_tickets']}")
    print(f"{'Estrategia':<22} {'HitRate':>9} {'Precision':>10} {'Cobertura':>10} {'Queries':>8}")
    for strategy in report["strategies"]:
        print(
            f"{strategy['name']:<22} {strategy['hit_rate']:>9.2%} "
            f"{strategy['precision']:>10.2%} {strategy['coverage']:>10.2%} "
            f"{strategy['n_queries']:>8}"
        )
    if report["hybrid_by_store"]:
        print("HitRate híbrido por tienda:", report["hybrid_by_store"])
    print("\nNotas:")
    for caveat in report["caveats"]:
        print(f"  - {caveat}")


if __name__ == "__main__":
    main()
