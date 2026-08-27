"""Domain errors mapped to HTTP status codes at the API boundary."""


class DomainError(Exception):
    """Base class for every business-rule violation."""

    status_code: int = 400


class ProductNotFound(DomainError):
    status_code = 404

    def __init__(self, sku: str) -> None:
        self.sku = sku
        super().__init__(f"Producto no encontrado: {sku}")


class StoreNotFound(DomainError):
    status_code = 404

    def __init__(self, store_id: int) -> None:
        self.store_id = store_id
        super().__init__(f"Tienda no encontrada: {store_id}")


class DuplicateSku(DomainError):
    status_code = 409

    def __init__(self, sku: str) -> None:
        self.sku = sku
        super().__init__(f"El SKU ya existe: {sku}")


class InsufficientStock(DomainError):
    """Raised when a purchase cannot be fully satisfied by shared inventory."""

    status_code = 409

    def __init__(self, sku: str, requested: int, available: int) -> None:
        self.sku = sku
        self.requested = requested
        self.available = available
        super().__init__(
            f"Stock insuficiente para {sku}: se solicitaron {requested}, disponibles {available}"
        )


class EmptyPurchase(DomainError):
    status_code = 400

    def __init__(self) -> None:
        super().__init__("La compra debe incluir al menos un producto")


class RuleNotFound(DomainError):
    status_code = 404

    def __init__(self, rule_id: int) -> None:
        self.rule_id = rule_id
        super().__init__(f"Regla no encontrada: {rule_id}")
