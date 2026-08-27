"""Application configuration.

All settings are resolved here through pydantic-settings so every other layer
reads plain values instead of touching os.environ directly.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"


class Settings(BaseSettings):
    """Runtime settings, overridable via backend/.env or environment variables."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Ferreteria Multi-Tienda API"
    app_version: str = "0.1.0"

    # SQLite database URL, e.g. sqlite://C:/path/to/ferreteria.db
    database_url: str = ""

    # Comma-separated list of allowed CORS origins.
    cors_origins: str = "http://localhost:5173"

    # OpenTelemetry
    service_name: str = "ferreteria-backend"
    otel_console: bool = False
    otlp_endpoint: str | None = None

    # Seed data files
    products_csv: Path = REPO_ROOT / "products.csv"
    sales_csv: Path = REPO_ROOT / "sales.csv"

    @property
    def db_url(self) -> str:
        """Resolve the SQLite connection string, anchored to the repo layout."""
        if self.database_url:
            return self.database_url
        data_dir = BACKEND_DIR / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        db_path = data_dir / "ferreteria.db"
        return f"sqlite://{db_path.as_posix()}"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
