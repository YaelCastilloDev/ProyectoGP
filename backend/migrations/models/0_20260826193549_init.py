from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "product" (
    "sku" VARCHAR(32) NOT NULL PRIMARY KEY,
    "nombre" VARCHAR(160) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" VARCHAR(64) NOT NULL,
    "material" VARCHAR(160) NOT NULL,
    "uso_recomendado" VARCHAR(160) NOT NULL,
    "precio" INT NOT NULL,
    "stock" INT NOT NULL
);
CREATE TABLE IF NOT EXISTS "store" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "nombre" VARCHAR(64) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS "blend_weights" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "w_cooccurrence" REAL NOT NULL,
    "w_content" REAL NOT NULL,
    "w_popularity" REAL NOT NULL,
    "store_id" INT NOT NULL UNIQUE REFERENCES "store" ("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "recommendation_rule" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "action" VARCHAR(8) NOT NULL,
    "weight" REAL NOT NULL,
    "note" VARCHAR(255) NOT NULL,
    "source_id" VARCHAR(32) REFERENCES "product" ("sku") ON DELETE CASCADE,
    "store_id" INT REFERENCES "store" ("id") ON DELETE CASCADE,
    "target_id" VARCHAR(32) NOT NULL REFERENCES "product" ("sku") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "sale" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "ticket_id" VARCHAR(32) NOT NULL,
    "cantidad" INT NOT NULL,
    "fecha" DATE NOT NULL,
    "product_id" VARCHAR(32) NOT NULL REFERENCES "product" ("sku") ON DELETE CASCADE,
    "store_id" INT NOT NULL REFERENCES "store" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_sale_ticket__4bc3e3" ON "sale" ("ticket_id");
CREATE TABLE IF NOT EXISTS "aerich" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSON NOT NULL
);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
    "eTTnUz"
)
