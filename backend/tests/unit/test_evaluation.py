"""Unit tests for the offline evaluation harness."""

from datetime import date

from backend.app.domain.entities import Product, SaleRow
from backend.app.domain.services.evaluation import run_offline_evaluation


def make_product(sku: str, group: str, stock: int = 10) -> Product:
    return Product(
        sku=sku,
        nombre=f"Producto {group}",
        descripcion="",
        categoria=group,
        material=group,
        uso_recomendado=group,
        precio=10,
        stock=stock,
    )


def make_dataset() -> tuple[list[Product], list[SaleRow]]:
    products = [
        make_product("A1", "grupo-a"),
        make_product("A2", "grupo-a"),
        make_product("B1", "grupo-b"),
        make_product("B2", "grupo-b"),
    ]
    tickets = [
        # train (before 2026-01-10): pairs sold together
        ("T1", "A1", "2026-01-01"),
        ("T1", "A2", "2026-01-01"),
        ("T2", "A1", "2026-01-02"),
        ("T2", "A2", "2026-01-02"),
        ("T3", "B1", "2026-01-03"),
        ("T3", "B2", "2026-01-03"),
        # test: continuation of the same patterns
        ("T4", "A1", "2026-01-10"),
        ("T4", "A2", "2026-01-10"),
        ("T5", "B1", "2026-01-11"),
        ("T5", "B2", "2026-01-11"),
    ]
    sales = [
        SaleRow(ticket_id=t, sku=s, store_id=1, cantidad=1, fecha=date.fromisoformat(d))
        for t, s, d in tickets
    ]
    return products, sales


def test_report_structure_and_content_signal_wins():
    products, sales = make_dataset()
    report = run_offline_evaluation(products, sales, split_date=date(2026, 1, 10), k=3)

    assert report.n_train_tickets == 3
    assert report.n_test_tickets == 2
    assert report.caveats

    by_name = {strategy.name: strategy for strategy in report.strategies}
    assert set(by_name) == {"random", "popularity_baseline", "cooccurrence", "content", "hybrid"}

    # The dataset is attribute-driven, so content must dominate the baselines.
    assert by_name["content"].hit_rate >= 0.9
    assert by_name["hybrid"].hit_rate >= by_name["random"].hit_rate
    assert by_name["random"].coverage == 1.0

    for strategy in report.strategies:
        assert 0.0 <= strategy.hit_rate <= 1.0
        assert 0.0 <= strategy.precision <= 1.0
        assert 0.0 <= strategy.coverage <= 1.0
        assert strategy.n_queries > 0


def test_metrics_bounds_with_edge_cases():
    products = [make_product("S", "solo")]
    sales = [
        SaleRow(ticket_id="T1", sku="S", store_id=1, cantidad=1, fecha=date(2026, 1, 1)),
        SaleRow(ticket_id="T2", sku="S", store_id=1, cantidad=1, fecha=date(2026, 2, 1)),
    ]
    report = run_offline_evaluation(products, sales, split_date=date(2026, 1, 15), k=3)
    for strategy in report.strategies:
        assert strategy.hit_rate == 0.0  # no co-purchase possible
