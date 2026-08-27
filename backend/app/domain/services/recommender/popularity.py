"""Popularity signal: per-store demand with global fallback.

Counts are log-scaled and min-max normalized against the strongest
product in the same distribution so the score stays in [0, 1] and is
comparable with the cosine signals. A store without history (e.g.
Mérida) falls back to the chain-wide counts.
"""

import math

from backend.app.domain.entities import SaleRow


class PopularityModel:
    def __init__(self, sales: list[SaleRow]) -> None:
        self.by_store: dict[int, dict[str, int]] = {}
        self.global_counts: dict[str, int] = {}
        for row in sales:
            self.by_store.setdefault(row.store_id, {})
            self.by_store[row.store_id][row.sku] = (
                self.by_store[row.store_id].get(row.sku, 0) + row.cantidad
            )
            self.global_counts[row.sku] = self.global_counts.get(row.sku, 0) + row.cantidad

    def score(self, sku: str, store_id: int) -> float:
        counts = self.by_store.get(store_id) or self.global_counts
        if not counts:
            return 0.0
        raw = counts.get(sku, 0)
        if raw == 0:
            return 0.0
        maximum = max(counts.values())
        return math.log1p(raw) / math.log1p(maximum)
