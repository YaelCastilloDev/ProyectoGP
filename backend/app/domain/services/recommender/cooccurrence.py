"""Market-basket signal: co-occurrence similarity between products.

Similarity model: each ticket is a "basket"; each product is a vector over
ticket dimensions (1 if the product appeared in that ticket). Two products
are similar when they appear in the same tickets — the standard item-item
cosine over the basket incidence matrix ("customers who bought X also
bought Y").

Tickets from all stores are pooled: the chain shares inventory and product
insight, and the per-store sample (9-12 distinct SKUs per store) is too
small to learn meaningful pairs in isolation.

Support/lift statistics are kept alongside for the explainability and
relationship-manager endpoints.
"""

from collections import Counter
from itertools import combinations
from math import sqrt

from backend.app.domain.entities import SaleRow


class CooccurrenceSimilarity:
    def __init__(self, sales: list[SaleRow]) -> None:
        self.pair_counts: Counter[tuple[str, str]] = Counter()
        self.ticket_popularity: Counter[str] = Counter()
        self.ticket_count = 0
        self._item_vectors: dict[str, dict[str, int]] = {}
        self._build(sales)

    def _build(self, sales: list[SaleRow]) -> None:
        tickets: dict[str, set[str]] = {}
        for row in sales:
            tickets.setdefault(row.ticket_id, set()).add(row.sku)
        self.ticket_count = len(tickets)

        for ticket_id, skus in tickets.items():
            self.ticket_popularity.update(skus)
            for sku in skus:
                self._item_vectors.setdefault(sku, {})[ticket_id] = 1
            for sku_a, sku_b in combinations(sorted(skus), 2):
                self.pair_counts[(sku_a, sku_b)] += 1

    def similarity(self, sku_a: str, sku_b: str) -> float:
        """Cosine over the ticket-incidence vectors of the two SKUs."""
        vector_a = self._item_vectors.get(sku_a, {})
        vector_b = self._item_vectors.get(sku_b, {})
        if not vector_a or not vector_b:
            return 0.0
        if len(vector_a) > len(vector_b):
            vector_a, vector_b = vector_b, vector_a
        dot = sum(vector_b[ticket_id] for ticket_id in vector_a if ticket_id in vector_b)
        norm_a = sqrt(len(vector_a))
        norm_b = sqrt(len(vector_b))
        return dot / (norm_a * norm_b)

    def support(self, sku_a: str, sku_b: str) -> int:
        return self.pair_counts.get((min(sku_a, sku_b), max(sku_a, sku_b)), 0)

    def lift(self, sku_a: str, sku_b: str) -> float:
        """P(A & B) / (P(A) * P(B)) estimated from ticket frequencies."""
        if self.ticket_count == 0:
            return 0.0
        popularity_a = self.ticket_popularity.get(sku_a, 0)
        popularity_b = self.ticket_popularity.get(sku_b, 0)
        if popularity_a == 0 or popularity_b == 0:
            return 0.0
        joint = self.support(sku_a, sku_b)
        pa = popularity_a / self.ticket_count
        pb = popularity_b / self.ticket_count
        return (joint / self.ticket_count) / (pa * pb) if pa * pb > 0 else 0.0

    def ranked_pairs(self, min_support: int = 1) -> list[dict]:
        """All discovered pairs, ranked by lift (for the relationship manager)."""
        pairs = []
        for (sku_a, sku_b), support in self.pair_counts.items():
            if support < min_support:
                continue
            pairs.append(
                {
                    "source_sku": sku_a,
                    "target_sku": sku_b,
                    "support": support,
                    "lift": round(self.lift(sku_a, sku_b), 3),
                }
            )
        pairs.sort(key=lambda pair: (-pair["lift"], -pair["support"]))
        return pairs
