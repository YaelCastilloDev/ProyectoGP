"""Content-based signal: TF-IDF cosine similarity between products.

Tokens come from the attributes the business uses to describe a product.
The description field is intentionally excluded: it contains free-form
marketing text that empirically diluted the signal in the offline
evaluation (HR@5 dropped from 0.625 to 0.594 on the seed dataset).
"""

import math
import re
from collections import Counter

from backend.app.domain.entities import Product

TOKEN_RE = re.compile(r"[a-záéíóúñü0-9]+")
CONTENT_FIELDS = ("nombre", "categoria", "material", "uso_recomendado")


class ContentSimilarity:
    def __init__(self, products: list[Product]) -> None:
        self._vectors: dict[str, dict[str, float]] = {}
        self._build(products)

    def _tokenize(self, text: str) -> list[str]:
        return TOKEN_RE.findall(text.lower())

    def _build(self, products: list[Product]) -> None:
        docs: dict[str, list[str]] = {}
        for product in products:
            text = " ".join(getattr(product, field) for field in CONTENT_FIELDS)
            docs[product.sku] = self._tokenize(text)

        document_frequency: Counter[str] = Counter()
        for tokens in docs.values():
            document_frequency.update(set(tokens))

        n_docs = len(docs)
        for sku, tokens in docs.items():
            if not tokens:
                continue
            term_frequency = Counter(tokens)
            vector = {
                token: (count / len(tokens))
                * (math.log(n_docs / (document_frequency[token] + 1)) + 1)
                for token, count in term_frequency.items()
            }
            norm = math.sqrt(sum(value * value for value in vector.values()))
            self._vectors[sku] = {t: v / norm for t, v in vector.items()} if norm else {}

    def similarity(self, sku_a: str, sku_b: str) -> float:
        vector_a = self._vectors.get(sku_a, {})
        vector_b = self._vectors.get(sku_b, {})
        if not vector_a or not vector_b:
            return 0.0
        if len(vector_a) > len(vector_b):
            vector_a, vector_b = vector_b, vector_a
        return sum(
            value * vector_a[token] for token, value in vector_b.items() if token in vector_a
        )

    def top_matches(
        self, sku: str, candidates: list[str], limit: int = 10
    ) -> list[tuple[str, float]]:
        scored = sorted(
            ((candidate, self.similarity(sku, candidate)) for candidate in candidates),
            key=lambda pair: -pair[1],
        )
        return [(s, v) for s, v in scored if v > 0][:limit]
