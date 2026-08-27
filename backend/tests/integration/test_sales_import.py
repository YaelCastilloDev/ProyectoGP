"""Sales history import endpoint: insert-only, idempotent, stock untouched."""


async def test_import_happy_path_and_idempotency(client):
    stock_before = (await client.get("/api/products/P1")).json()["stock"]
    payload = {
        "rows": [
            {"ticket_id": "T9", "sku": "P1", "cantidad": 2, "fecha": "2026-03-10"},
            {"ticket_id": "T9", "sku": "P2", "cantidad": 1, "fecha": "2026-03-10"},
        ]
    }
    response = await client.post("/api/stores/1/sales/import", json=payload)
    assert response.status_code == 201
    assert response.json() == {"imported": 2}

    assert (await client.get("/api/products/P1")).json()["stock"] == stock_before

    rows = (await client.get("/api/stores/1/sales")).json()["rows"]
    assert any(row["ticket_id"] == "T9" for row in rows)

    again = await client.post("/api/stores/1/sales/import", json=payload)
    assert again.status_code == 201
    assert again.json() == {"imported": 0}


async def test_import_preserves_dates_and_adds_to_other_store(client):
    response = await client.post(
        "/api/stores/2/sales/import",
        json={"rows": [{"ticket_id": "T9", "sku": "P1", "cantidad": 1, "fecha": "2026-04-01"}]},
    )
    assert response.status_code == 201
    assert response.json() == {"imported": 1}

    rows = (await client.get("/api/stores/2/sales")).json()["rows"]
    imported = [row for row in rows if row["ticket_id"] == "T9"]
    assert len(imported) == 1
    assert imported[0]["fecha"] == "2026-04-01"


async def test_import_unknown_store_and_sku(client):
    missing_store = await client.post(
        "/api/stores/99/sales/import",
        json={"rows": [{"ticket_id": "T9", "sku": "P1", "cantidad": 1, "fecha": "2026-03-10"}]},
    )
    assert missing_store.status_code == 404

    missing_sku = await client.post(
        "/api/stores/1/sales/import",
        json={"rows": [{"ticket_id": "T9", "sku": "NOPE", "cantidad": 1, "fecha": "2026-03-10"}]},
    )
    assert missing_sku.status_code == 404


async def test_import_empty_rows_rejected(client):
    response = await client.post("/api/stores/1/sales/import", json={"rows": []})
    assert response.status_code == 422
