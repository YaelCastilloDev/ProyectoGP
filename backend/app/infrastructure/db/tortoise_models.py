"""Tortoise-ORM models and the TORTOISE_ORM config consumed by Aerich."""

from tortoise import fields
from tortoise.models import Model

from backend.app.config import get_settings


class Store(Model):
    id = fields.IntField(primary_key=True)
    nombre = fields.CharField(max_length=64, unique=True)

    class Meta:
        table = "store"


class Product(Model):
    sku = fields.CharField(primary_key=True, max_length=32)
    nombre = fields.CharField(max_length=160)
    descripcion = fields.TextField()
    categoria = fields.CharField(max_length=64)
    material = fields.CharField(max_length=160)
    uso_recomendado = fields.CharField(max_length=160)
    precio = fields.IntField()
    stock = fields.IntField()

    class Meta:
        table = "product"


class Sale(Model):
    id = fields.BigIntField(primary_key=True)
    ticket_id = fields.CharField(max_length=32, db_index=True)
    product = fields.ForeignKeyField("models.Product", related_name="sales")
    store = fields.ForeignKeyField("models.Store", related_name="sales")
    cantidad = fields.IntField()
    fecha = fields.DateField()

    class Meta:
        table = "sale"


class RecommendationRule(Model):
    id = fields.IntField(primary_key=True)
    store = fields.ForeignKeyField("models.Store", null=True, related_name="rules")
    source = fields.ForeignKeyField("models.Product", null=True, related_name="rules_as_source")
    target = fields.ForeignKeyField("models.Product", related_name="rules_as_target")
    action = fields.CharField(max_length=8)
    weight = fields.FloatField(default=1.0)
    note = fields.CharField(max_length=255, default="")

    class Meta:
        table = "recommendation_rule"


class BlendWeights(Model):
    id = fields.IntField(primary_key=True)
    store = fields.OneToOneField("models.Store", related_name="blend_weights")
    w_cooccurrence = fields.FloatField(default=0.3)
    w_content = fields.FloatField(default=0.9)
    w_popularity = fields.FloatField(default=0.1)

    class Meta:
        table = "blend_weights"


def build_orm_config(db_url: str) -> dict:
    return {
        "connections": {"default": db_url},
        "apps": {
            "models": {
                "models": [
                    "backend.app.infrastructure.db.tortoise_models",
                    "aerich.models",
                ],
                "default_connection": "default",
            }
        },
    }


# Module-level config used by the Aerich CLI (`aerich init-db`).
TORTOISE_ORM = build_orm_config(get_settings().db_url)
