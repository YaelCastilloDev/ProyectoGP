"""Hybrid recommendation engine.

Combines the three signals with per-store blend weights and applies the
business rules (block/boost) before ranking. Every recommendation carries
its score decomposition so the business can see *why* something is
suggested.
"""

from backend.app.domain.entities import (
    BlendWeights,
    Product,
    Recommendation,
    RecommendationRule,
)
from backend.app.domain.services.recommender.content import ContentSimilarity
from backend.app.domain.services.recommender.cooccurrence import CooccurrenceSimilarity
from backend.app.domain.services.recommender.popularity import PopularityModel


class RecommenderEngine:
    def __init__(
        self,
        products: list[Product],
        content: ContentSimilarity,
        cooccurrence: CooccurrenceSimilarity,
        popularity: PopularityModel,
        rules: list[RecommendationRule] | None = None,
        weights: BlendWeights | None = None,
    ) -> None:
        self.products = {product.sku: product for product in products}
        self.content = content
        self.cooccurrence = cooccurrence
        self.popularity = popularity
        self.rules = rules or []
        self.weights = weights or BlendWeights(store_id=0)

    def recommend(
        self, seed_skus: list[str], store_id: int, limit: int = 5
    ) -> list[Recommendation]:
        """Recommend products given what is already in the cart."""
        seeds = {sku for sku in seed_skus if sku in self.products}
        weights = self.weights

        blocked = self._blocked_targets(seeds, store_id)
        boosts = self._boost_multipliers(seeds, store_id)

        candidates: list[Recommendation] = []
        for product in self.products.values():
            if product.sku in seeds or product.stock <= 0 or product.sku in blocked:
                continue

            content_score = max(
                (self.content.similarity(seed, product.sku) for seed in seeds), default=0.0
            )
            cooc_score = max(
                (self.cooccurrence.similarity(seed, product.sku) for seed in seeds), default=0.0
            )
            pop_score = self.popularity.score(product.sku, store_id)
            multiplier = boosts.get(product.sku, 1.0)

            base = (
                weights.w_content * content_score
                + weights.w_cooccurrence * cooc_score
                + weights.w_popularity * pop_score
            )
            if base <= 0 and multiplier != 1.0:
                # A business boost must be able to surface products with no
                # learned signal (cold-start pairings): give it a unit base.
                base = 1.0
            score = base * multiplier
            if score <= 0:
                continue

            candidates.append(
                Recommendation(
                    sku=product.sku,
                    nombre=product.nombre,
                    precio=product.precio,
                    stock=product.stock,
                    score=round(score, 4),
                    content=round(content_score, 4),
                    cooccurrence=round(cooc_score, 4),
                    popularity=round(pop_score, 4),
                    rule_boost=multiplier,
                    reasons=self._reasons(
                        product.sku, seeds, content_score, cooc_score, pop_score, multiplier
                    ),
                )
            )

        candidates.sort(key=lambda rec: -rec.score)
        return candidates[:limit]

    def _blocked_targets(self, seeds: set[str], store_id: int) -> set[str]:
        blocked: set[str] = set()
        for rule in self.rules:
            if rule.action != "block" or not self._rule_applies(rule, store_id):
                continue
            if rule.source_sku is None or rule.source_sku in seeds:
                blocked.add(rule.target_sku)
        return blocked

    def _boost_multipliers(self, seeds: set[str], store_id: int) -> dict[str, float]:
        boosts: dict[str, float] = {}
        for rule in self.rules:
            if rule.action != "boost" or not self._rule_applies(rule, store_id):
                continue
            if rule.source_sku is None or rule.source_sku in seeds:
                boosts[rule.target_sku] = max(boosts.get(rule.target_sku, 1.0), rule.weight)
        return boosts

    @staticmethod
    def _rule_applies(rule: RecommendationRule, store_id: int) -> bool:
        return rule.store_id is None or rule.store_id == store_id

    def _reasons(
        self,
        target_sku: str,
        seeds: set[str],
        content_score: float,
        cooc_score: float,
        pop_score: float,
        multiplier: float,
    ) -> list[str]:
        reasons: list[str] = []
        if cooc_score > 0:
            best = max(
                (seed for seed in seeds if self.cooccurrence.similarity(seed, target_sku) > 0),
                key=lambda seed: self.cooccurrence.similarity(seed, target_sku),
                default=None,
            )
            if best is not None:
                support = self.cooccurrence.support(best, target_sku)
                reasons.append(f"Se ha comprado junto a {best} en {support} ticket(s)")
        if content_score > 0:
            best = max(
                seeds,
                key=lambda seed: self.content.similarity(seed, target_sku),
                default=None,
            )
            if best is not None:
                reasons.append(f"Similar en atributos a {best}")
        if pop_score > 0 and not (content_score or cooc_score):
            reasons.append("Producto popular en la tienda")
        if multiplier != 1.0:
            reasons.append("Potenciado por regla del negocio")
        return reasons
