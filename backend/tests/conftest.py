"""Shared test fixtures.

Every test gets a fresh SQLite database under tmp_path, seeded with a
small deterministic dataset. Tortoise is initialized with global fallback
so requests handled in different tasks can reach the same connections.
"""

from datetime import date
from pathlib import Path

import httpx
import pytest
from tortoise import Tortoise

from backend.app.config import Settings
from backend.app.infrastructure.db.tortoise_models import Product, Sale, Store
from backend.app.main import create_app

MODELS = ["backend.app.infrastructure.db.tortoise_models"]

PRODUCTS = [
    {
        "sku": "P1",
        "nombre": "Taladro percutor",
        "descripcion": "",
        "categoria": "herramienta eléctrica",
        "material": "acero",
        "uso_recomendado": "perforación de concreto",
        "precio": 100,
        "stock": 10,
    },
    {
        "sku": "P2",
        "nombre": "Broca para concreto",
        "descripcion": "",
        "categoria": "consumible",
        "material": "widia",
        "uso_recomendado": "perforación de concreto",
        "precio": 10,
        "stock": 50,
    },
    {
        "sku": "P3",
        "nombre": "Pintura interior",
        "descripcion": "",
        "categoria": "pintura",
        "material": "vinil acrílico",
        "uso_recomendado": "interior",
        "precio": 80,
        "stock": 5,
    },
    {
        "sku": "P4",
        "nombre": "Tornillo para interior",
        "descripcion": "",
        "categoria": "fijación",
        "material": "acero al carbón",
        "uso_recomendado": "interior",
        "precio": 5,
        "stock": 3,
    },
    {
        "sku": "P5",
        "nombre": "Candado agotado",
        "descripcion": "",
        "categoria": "seguridad",
        "material": "acero",
        "uso_recomendado": "interior",
        "precio": 40,
        "stock": 0,
    },
]

SALES = [
    # ticket, sku, cantidad, store_id, fecha
    ("T1", "P1", 1, 1, "2026-01-01"),
    ("T1", "P2", 2, 1, "2026-01-01"),
    ("T2", "P1", 1, 1, "2026-01-05"),
    ("T2", "P2", 1, 1, "2026-01-05"),
    ("T3", "P3", 2, 2, "2026-01-10"),
    ("T3", "P4", 1, 2, "2026-01-10"),
    ("T4", "P1", 1, 1, "2026-02-01"),
    ("T4", "P2", 1, 1, "2026-02-01"),
    ("T5", "P3", 1, 2, "2026-02-02"),
    ("T5", "P4", 1, 2, "2026-02-02"),
]


def make_test_settings(db_path: Path) -> Settings:
    return Settings(database_url=f"sqlite://{db_path.as_posix()}")


async def init_db(db_path: Path) -> None:
    await Tortoise.init(
        db_url=f"sqlite://{db_path.as_posix()}",
        modules={"models": MODELS},
        _enable_global_fallback=True,
    )
    await Tortoise.generate_schemas(safe=True)
    await Store.create(nombre="Tienda A")
    await Store.create(nombre="Tienda B")
    await Product.bulk_create([Product(**data) for data in PRODUCTS])
    await Sale.bulk_create(
        [
            Sale(ticket_id=t, product_id=s, store_id=st, cantidad=q, fecha=date.fromisoformat(d))
            for t, s, q, st, d in SALES
        ]
    )


@pytest.fixture
async def client(tmp_path):
    db_path = tmp_path / "test.db"
    await init_db(db_path)
    app = create_app(make_test_settings(db_path), skip_db_init=True)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
    await Tortoise.close_connections()
