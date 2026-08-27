"""Offline evaluation of the recommendation system.

Runs the temporal holdout described in domain/services/evaluation.py and
returns the full report (ablation per signal + baselines + coverage).
"""

from datetime import date

from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import get_product_repo, get_sale_repo
from backend.app.domain.services.evaluation import EvaluationReport, run_offline_evaluation
from backend.app.infrastructure.repositories.product_repo import TortoiseProductRepository
from backend.app.infrastructure.repositories.sale_repo import TortoiseSaleRepository

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.get("", response_model=EvaluationReport)
async def evaluate(
    split_date: date = Query(default=date(2026, 3, 5)),
    k: int = Query(default=5, ge=1, le=20),
    products: TortoiseProductRepository = Depends(get_product_repo),
    sales: TortoiseSaleRepository = Depends(get_sale_repo),
):
    catalog = await products.list_all()
    rows = await sales.all_rows()
    return run_offline_evaluation(catalog, rows, split_date=split_date, k=k)
