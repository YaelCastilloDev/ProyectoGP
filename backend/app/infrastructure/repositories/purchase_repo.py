"""Tortoise implementation of PurchaseRepository.

Atomicity strategy (SQLite):
- Everything runs inside a single `in_transaction()` block.
- Each line is a conditional UPDATE (`stock = stock - qty WHERE stock >= qty`);
  if the affected row count is 0 the line cannot be satisfied, an
  InsufficientStock error is raised and the whole transaction rolls back.
- Sale rows are inserted with the same connection, so a ticket is either
  fully persisted (with its deductions) or not at all.

This holds the "inventory is never oversold" invariant even when two
stores buy the same product concurrently.
"""

from datetime import date

from tortoise.transactions import in_transaction

from backend.app.domain.entities import PurchaseItem
from backend.app.domain.errors import InsufficientStock

UPDATE_STOCK_SQL = "UPDATE product SET stock = stock - ? WHERE sku = ? AND stock >= ?"
INSERT_SALE_SQL = (
    "INSERT INTO sale (ticket_id, product_id, store_id, cantidad, fecha) VALUES (?, ?, ?, ?, ?)"
)
SELECT_STOCK_SQL = "SELECT stock FROM product WHERE sku = ?"


class TortoisePurchaseRepository:
    async def execute(
        self,
        store_id: int,
        ticket_id: str,
        fecha: date,
        lines: list[PurchaseItem],
    ) -> None:
        async with in_transaction() as connection:
            for line in lines:
                affected, _ = await connection.execute_query(
                    UPDATE_STOCK_SQL, [line.cantidad, line.sku, line.cantidad]
                )
                if affected != 1:
                    _, rows = await connection.execute_query(SELECT_STOCK_SQL, [line.sku])
                    available = rows[0]["stock"] if rows else 0
                    raise InsufficientStock(
                        sku=line.sku, requested=line.cantidad, available=available
                    )
            for line in lines:
                await connection.execute_query(
                    INSERT_SALE_SQL,
                    [ticket_id, line.sku, store_id, line.cantidad, fecha.isoformat()],
                )
