"""Unit tests for the co-occurrence signal."""

from datetime import date

from backend.app.domain.entities import SaleRow
from backend.app.domain.services.recommender.cooccurrence import CooccurrenceSimilarity


def make_sales() -> list[SaleRow]:
    rows = [
        ("T1", "A", 1),
        ("T1", "B", 2),
        ("T2", "A", 1),
        ("T2", "B", 1),
        ("T3", "A", 1),
        ("T3", "C", 1),
        ("T4", "D", 1),
    ]
    return [
        SaleRow(ticket_id=t, sku=s, store_id=1, cantidad=q, fecha=date(2026, 1, 1))
        for t, s, q in rows
    ]


def test_pair_counts_and_support():
    model = CooccurrenceSimilarity(make_sales())
    assert model.support("A", "B") == 2
    assert model.support("A", "C") == 1
    assert model.support("B", "C") == 0
    assert model.support("A", "A") == 0


def test_similarity_is_symmetric_and_bounded():
    model = CooccurrenceSimilarity(make_sales())
    value = model.similarity("A", "B")
    assert 0 < value <= 1.0
    assert model.similarity("A", "B") == model.similarity("B", "A")
    assert model.similarity("B", "D") == 0.0


def test_lift_above_one_for_co_bought_pair():
    model = CooccurrenceSimilarity(make_sales())
    assert model.lift("A", "B") > 1.0


def test_ranked_pairs_sorted_by_lift():
    model = CooccurrenceSimilarity(make_sales())
    pairs = model.ranked_pairs(min_support=1)
    lifts = [pair["lift"] for pair in pairs]
    assert lifts == sorted(lifts, reverse=True)
    assert pairs[0]["support"] == 2
