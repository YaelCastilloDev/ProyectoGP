"""Product CRUD integration tests."""


async def test_list_products(client):
    response = await client.get("/api/products")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 5
    assert {p["sku"] for p in body} == {"P1", "P2", "P3", "P4", "P5"}


async def test_get_product(client):
    response = await client.get("/api/products/P1")
    assert response.status_code == 200
    assert response.json()["nombre"] == "Taladro percutor"
    assert response.json()["stock"] == 10


async def test_get_product_missing(client):
    response = await client.get("/api/products/NOPE")
    assert response.status_code == 404


async def test_create_product(client):
    payload = {
        "sku": "P9",
        "nombre": "Martillo",
        "descripcion": "",
        "categoria": "herramienta",
        "material": "acero",
        "uso_recomendado": "general",
        "precio": 90,
        "stock": 7,
    }
    response = await client.post("/api/products", json=payload)
    assert response.status_code == 201
    assert response.json()["sku"] == "P9"

    duplicate = await client.post("/api/products", json=payload)
    assert duplicate.status_code == 409


async def test_update_product(client):
    response = await client.patch("/api/products/P4", json={"stock": 0, "precio": 6})
    assert response.status_code == 200
    assert response.json()["stock"] == 0
    assert response.json()["precio"] == 6

    missing = await client.patch("/api/products/NOPE", json={"stock": 1})
    assert missing.status_code == 404


async def test_delete_product(client):
    response = await client.delete("/api/products/P3")
    assert response.status_code == 204

    gone = await client.get("/api/products/P3")
    assert gone.status_code == 404

    again = await client.delete("/api/products/P3")
    assert again.status_code == 404
