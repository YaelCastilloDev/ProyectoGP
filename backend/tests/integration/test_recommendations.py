"""Recommendation, rules and evaluation integration tests."""


async def test_recommendations_are_sensible_and_explainable(client):
    response = await client.get("/api/recommendations?store_id=1&cart=P1&limit=3")
    assert response.status_code == 200
    body = response.json()
    assert body["seeds"] == ["P1"]
    skus = [item["sku"] for item in body["items"]]
    assert "P1" not in skus
    assert "P5" not in skus  # out of stock: never recommended
    assert "P2" in skus  # co-purchased + attribute-similar

    top = body["items"][0]
    assert top["reasons"]
    assert top["score"] > 0
    assert set(body["weights_used"]) == {"w_cooccurrence", "w_content", "w_popularity"}


async def test_recommendations_cart_support(client):
    response = await client.get("/api/recommendations?store_id=1&cart=P1,P3&limit=3")
    assert response.status_code == 200
    skus = [item["sku"] for item in response.json()["items"]]
    assert "P1" not in skus and "P3" not in skus


async def test_block_rule_removes_target(client):
    created = await client.post(
        "/api/rules",
        json={"source_sku": "P1", "target_sku": "P2", "action": "block", "weight": 1.0},
    )
    assert created.status_code == 201
    response = await client.get("/api/recommendations?store_id=1&cart=P1&limit=3")
    skus = [item["sku"] for item in response.json()["items"]]
    assert "P2" not in skus


async def test_boost_rule_raises_target(client):
    await client.post(
        "/api/rules",
        json={"source_sku": "P1", "target_sku": "P4", "action": "boost", "weight": 100.0},
    )
    response = await client.get("/api/recommendations?store_id=1&cart=P1&limit=3")
    items = response.json()["items"]
    assert items and items[0]["sku"] == "P4"
    assert items[0]["rule_boost"] == 100.0


async def test_store_scoped_rule(client):
    await client.post(
        "/api/rules",
        json={"store_id": 2, "source_sku": "P1", "target_sku": "P2", "action": "block"},
    )
    response_store2 = await client.get("/api/recommendations?store_id=2&cart=P1&limit=3")
    skus_store2 = [item["sku"] for item in response_store2.json()["items"]]
    response_store1 = await client.get("/api/recommendations?store_id=1&cart=P1&limit=3")
    skus_store1 = [item["sku"] for item in response_store1.json()["items"]]
    assert "P2" not in skus_store2
    assert "P2" in skus_store1


async def test_rules_crud_and_discovery(client):
    created = await client.post(
        "/api/rules",
        json={
            "source_sku": "P3",
            "target_sku": "P4",
            "action": "boost",
            "weight": 1.5,
            "note": "test",
        },
    )
    assert created.status_code == 201
    rule_id = created.json()["id"]
    assert created.json()["target_nombre"] == "Tornillo para interior"

    rules = await client.get("/api/rules")
    assert len(rules.json()) == 1

    deleted = await client.delete(f"/api/rules/{rule_id}")
    assert deleted.status_code == 204
    assert (await client.delete(f"/api/rules/{rule_id}")).status_code == 404

    discovered = await client.get("/api/rules/discovered?min_support=1")
    body = discovered.json()
    cooc_pairs = {(p["source_sku"], p["target_sku"]) for p in body["cooccurrence"]}
    assert ("P1", "P2") in cooc_pairs or ("P2", "P1") in cooc_pairs
    assert body["content"]


async def test_weights_defaults_and_update(client):
    response = await client.get("/api/stores/1/weights")
    assert response.status_code == 200
    defaults = response.json()
    assert defaults["w_content"] == 0.9

    updated = await client.put(
        "/api/stores/1/weights",
        json={"w_cooccurrence": 0.0, "w_content": 1.0, "w_popularity": 0.0},
    )
    assert updated.status_code == 200
    assert updated.json()["w_cooccurrence"] == 0.0

    response = await client.get("/api/stores/99/weights")
    assert response.status_code == 404


async def test_explain_pair(client):
    response = await client.get("/api/recommendations/explain?store_id=1&source=P1&target=P2")
    assert response.status_code == 200
    body = response.json()
    assert body["support_tickets"] == 3
    assert body["lift"] > 1.0
    assert body["content_similarity"] > 0
    assert body["applicable_rules"] == []


async def test_evaluation_report(client):
    response = await client.get("/api/evaluation?split_date=2026-01-20&k=3")
    assert response.status_code == 200
    body = response.json()
    names = {strategy["name"] for strategy in body["strategies"]}
    assert names == {"random", "popularity_baseline", "cooccurrence", "content", "hybrid"}
    by_name = {strategy["name"]: strategy for strategy in body["strategies"]}
    assert by_name["content"]["hit_rate"] >= 0.5
    assert by_name["hybrid"]["hit_rate"] >= 0.5
    assert by_name["random"]["hit_rate"] <= by_name["content"]["hit_rate"]
    assert body["n_test_tickets"] >= 2
    assert body["caveats"]


async def test_sales_history(client):
    response = await client.get("/api/stores/1/sales?limit=10")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 4
    assert all(row["ticket_id"] for row in body["rows"])
    assert (await client.get("/api/stores/99/sales")).status_code == 404
