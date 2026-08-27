"""Recommendation engine: hybrid statistical recommender.

Three signals, blended with per-store weights:
- Content similarity: TF-IDF cosine over the product attributes
  (nombre, categoria, material, uso_recomendado). Handles cold start
  (new products, stores with no history like Mérida).
- Co-occurrence: cosine over co-purchase vectors built from tickets
  ("customers who bought X also bought Y").
- Popularity: per-store unit counts with global fallback, log-scaled
  and min-max normalized.

Business rules (see entities.RecommendationRule):
- Only products with stock > 0 are recommended (hard requirement).
- Block rules remove targets; boost rules multiply scores.
- Rules can be global (store_id=None) or scoped to a store, and can
  apply to a source product or to every query (source_sku=None).
"""
