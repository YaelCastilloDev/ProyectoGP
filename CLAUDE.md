# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Ferretería multi-tienda (5 stores: Cancún, Chihuahua, CDMX, Monterrey, Mérida) with
shared inventory, a purchase flow and a hybrid recommendation system. Backend:
FastAPI + Tortoise-ORM + SQLite. Frontend: React + Vite (JSX).

## Tech Stack

### Backend
- **Language**: Python 3.13
- **Framework**: FastAPI, Uvicorn
- **ORM**: Tortoise-ORM (+ aiosqlite), migrations with **Aerich**
- **Validation/config**: Pydantic v2 + pydantic-settings
- **Observability**: OpenTelemetry (traces + metrics)
- **Testing**: pytest + pytest-asyncio + httpx
- **Linting**: ruff (config in `ruff.toml`)

### Frontend
- React 19 + Vite 5, Tailwind CSS v4 + shadcn/ui, react-router-dom, axios (JSX)

## Project Structure

```
├── products.csv / sales.csv        # Seed data (catalog + sales history)
├── pyproject.toml                  # uv project (deps, aerich, pytest config)
├── backend/
│   ├── migrations/                 # Aerich migrations
│   ├── data/ferreteria.db          # SQLite (generated, gitignored)
│   ├── app/
│   │   ├── main.py                 # App factory + lifespan + CORS + OTel
│   │   ├── config.py               # pydantic-settings
│   │   ├── telemetry.py            # OpenTelemetry setup
│   │   ├── domain/                 # PURE business rules (no framework imports)
│   │   │   ├── entities.py, ports.py, errors.py
│   │   │   └── services/           # catalog, inventory, purchasing, recommender/, evaluation
│   │   ├── infrastructure/         # Tortoise models, repositories, CSV seeding
│   │   ├── api/                    # routes/, schemas.py, deps.py
│   │   └── scripts/                # seed.py, evaluate.py
│   └── tests/                      # unit/ + integration/
└── frontend/
```

## Development Commands

```bash
python bootstrap.py                        # zero-to-running: uv + deps + migrations + seed
python bootstrap.py --fresh --no-seed      # fresh DB without seed data
python bootstrap.py --test                 # + run tests
python bootstrap.py --run                  # + start the API
python bootstrap.py --web                  # + npm install (frontend deps)

uv sync                                     # install dependencies
uv run aerich upgrade                       # apply migrations
uv run python -m backend.app.scripts.seed   # wipe + reload CSVs into SQLite (destructive)
uv run python -m backend.app.scripts.import_data  # load CSVs through API endpoints (server must be up)
uv run uvicorn backend.app.main:app --reload  # API on http://localhost:8000
uv run pytest                               # run tests (55)
uv run ruff check backend                   # lint
uv run ruff format backend                  # format
uv run python -m backend.app.scripts.evaluate  # offline evaluation report

cd frontend && npm install && npm run dev   # frontend on http://localhost:5173
cd frontend && npm run lint && npm run build
```

Run from the repo root. Do not `cd` into backend/.

Postman: import `postman/ferreteria-happy-path.postman_collection.json` and run in
order (covers the full happy path; store IDs are captured dynamically).

## Architecture Rules

- Layered architecture: `domain` (business rules, zero framework imports) →
  `infrastructure` (Tortoise repos implementing domain ports) → `api` (FastAPI
  boundary with Pydantic schemas).
- Business invariants live in the domain layer:
  - Inventory is never oversold: purchases use conditional
    `UPDATE ... WHERE stock >= qty` in a single transaction, all-or-nothing.
  - Recommendations only include in-stock products, never items already in the cart.
- Tortoise 1.1.x requires `Tortoise.init(..., _enable_global_fallback=True)` so
  lifespan and request tasks share connections.
- Tortoise `execute_query` returns `(affected_count, rows)` — mind the tuple order.
- Aerich (not Alembic) is the migration tool for Tortoise.
- ruff: `Query()`/`Depends()` in FastAPI defaults and `*NotFound` exception names
  are intentionally allowed (see `ruff.toml` ignores).

## Recommendation System

Hybrid statistical engine (see README): co-occurrence (ticket-incidence cosine) +
content TF-IDF (nombre+categoria+material+uso, NOT descripcion) + per-store
popularity, blended with per-store weights; business rules (boost/block) applied
before ranking. Every recommendation carries its score decomposition. Verification:
temporal holdout + leave-one-out, exposed via `/api/evaluation` and the CLI.

## Environment & Config

- `backend/.env` (optional): `DATABASE_URL`, `CORS_ORIGINS`, `OTEL_CONSOLE`,
  `OTLP_ENDPOINT`, `PRODUCTS_CSV`, `SALES_CSV` (see `backend/.env.example`).
  Never commit `.env`. Note: `OTLP_ENDPOINT` only exports if the optional
  `opentelemetry-exporter-otlp-proto-grpc` package is installed.
- Frontend env vars: prefix with `VITE_` in `frontend/.env`.

## Troubleshooting

- CORS errors: check `cors_origins` in Settings.
- DB connection: SQLite file under `backend/data/ferreteria.db`.
- Port conflicts: frontend 5173, backend 8000.
