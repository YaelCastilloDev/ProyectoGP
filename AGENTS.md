# AGENTS.md

Hard-earned, repo-specific guidance. For the full architecture narrative and recsys
design, see `CLAUDE.md` (project doc) and `README.md`.

## Commands (always from repo root, never `cd backend/`)

```bash
python bootstrap.py               # zero-to-running: uv + deps + migrations + seed
python bootstrap.py --fresh --run # fresh DB + start API
uv sync                                          # deps + editable install of `backend` package
uv run aerich upgrade                            # apply migrations
uv run python -m backend.app.scripts.seed       # wipe + reload CSVs into SQLite
uv run python -m backend.app.scripts.import_data # load CSVs through business API endpoints (server must be up)
uv run uvicorn backend.app.main:app --reload    # API on :8000 (docs at /docs)
uv run pytest                                    # all tests
uv run pytest backend/tests/unit/test_engine.py::test_boost_rule_multiplies_score   # single test
uv run ruff check backend && uv run ruff format backend
uv run python -m backend.app.scripts.evaluate   # offline recsys evaluation report
```

- `uv` is NOT bundled with the toolchain: if missing, `pip install uv`.
- First-run order matters: `uv sync` → `aerich upgrade` → `seed` → `uvicorn`.
  (Server auto-generates the schema only when the SQLite file is absent — POC convenience;
  Aerich is still the source of truth.)

## Tortoise-ORM 1.1.x quirks (easy to get wrong)

- `Tortoise.init(..., _enable_global_fallback=True)` is REQUIRED: in 1.1.x, lifespan
  and request tasks run in different asyncio contexts and queries raise
  `RuntimeError: No TortoiseContext is currently active` without the fallback.
- `connection.execute_query(...)` returns `(affected_count, rows)` — mind the order.
- `pk=True` / `index=True` are deprecated: use `primary_key=True` / `db_index=True`.
- The `tortoise-orm[aiosqlite]` extra does not exist in 1.1.8: declare plain
  `tortoise-orm` + `aiosqlite` in `pyproject.toml`.
- Aerich is the migration tool (Alembic is SQLAlchemy-only; don't "fix" this).
- `Tortoise.close_connections()` clears the global context, so per-test init/teardown
  works — don't "optimize" the conftest into a session-scoped init without re-testing.

## Architecture invariants (break these and tests fail)

- Layering: `domain/` has zero FastAPI/Tortoise imports; infrastructure implements
  the Protocols in `domain/ports.py`; `api/` is the only HTTP boundary.
- No-oversell is enforced by conditional `UPDATE ... SET stock = stock - qty WHERE
  stock >= qty` + affected-row check inside ONE `in_transaction()` block, all-or-nothing.
  Covered by a concurrency test (20 parallel buys of stock 3 → exactly 3 succeed).
- Domain errors map to HTTP codes via their `status_code` attribute (main.py handler).

## Recommender (non-obvious decisions)

- Content TF-IDF tokenizes `nombre+categoria+material+uso_recomendado` only —
  `descripcion` is deliberately excluded (empirically lowers HR@5).
- The engine is rebuilt per request by design (28 products / 89 sale rows in 42
  tickets); don't add caching or "incremental indexing" — it's documented as the
  production scale-up path.
- Default blend weights are content-dominant (0.9/0.3/0.1); business-tunable per store.
- Evaluation default split date is 2026-03-05 (temporal holdout + leave-one-out).

## Data & tests

- `python -m backend.app.scripts.seed` is DESTRUCTIVE: wipes sale/rule/weight/product/
  store tables, then reloads. Mérida has no sales rows on purpose (cold-start case).
- Tests: pytest-asyncio auto mode (no decorators). Conftest creates a fresh SQLite
  per test under tmp_path with a small deterministic fixture (P1–P5, T1–T5).
- ruff intentionally ignores `B008` (FastAPI Query/Depends defaults) and `N818`
  (domain exception names without `Error` suffix) — see `ruff.toml`.
- Ports: backend 8000, frontend 5173. A stale uvicorn on 8000 serves old code; kill it
  before smoke-testing (`Get-NetTCPConnection -LocalPort 8000`).

## Frontend status

`frontend/` is a Vite React **JSX** app (no TypeScript) wired to the API, themed with
shadcn (CLI v4, `radix-nova` preset, Tailwind v4 via `@tailwindcss/vite`). Layout is the
`dashboard-01` block, adapted: sidebar store-switcher + sections Dashboard, Productos,
Ventas, Compras, Reglas, Evaluación (`src/sections/*.jsx`). Recomendaciones is merged
into Compras: picking products in the ticket auto-fetches suggestions below it.
`/recomendaciones` redirects to `/compras`.

- Commands: `npm install`, `npm run dev` (5173), `npm run lint`, `npm run build`.
- `src/lib/api.js` is the only HTTP boundary (`VITE_API_URL`, default
  `http://localhost:8000/api`); `src/context/store-context.jsx` holds the active store.
- All mutations show sonner toasts (success/error with backend `detail`).
- ESLint: `react/prop-types` is off (shadcn-generated components have no PropTypes);
  files under `src/components/ui/**` skip `no-unused-vars` — don't "fix" generated code.
- `components.json` has `tsx:false`: `npx shadcn@latest add <x>` emits `.jsx` files.
  Re-running `init` requires Tailwind v4 + the `@` alias to already exist.
- Deleting shadcn UI components/deps: keep `toggle`, `toggle-group`, `sheet` (used by
  chart and sidebar); anything else unused can go.
