"""Store onboarding endpoint (POST /api/stores)."""


async def test_create_store(client):
    response = await client.post("/api/stores", json={"nombre": "Tienda Nueva"})
    assert response.status_code == 201
    body = response.json()
    assert body["nombre"] == "Tienda Nueva"
    assert isinstance(body["id"], int)

    stores = (await client.get("/api/stores")).json()
    assert any(store["nombre"] == "Tienda Nueva" for store in stores)


async def test_create_duplicate_store_conflict(client):
    response = await client.post("/api/stores", json={"nombre": "Tienda A"})
    assert response.status_code == 409
