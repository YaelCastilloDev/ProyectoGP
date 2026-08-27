# Ferretería Multi-Tienda — Inventario Compartido + Sistema de Recomendación

POC de una cadena ferretera con 5 tiendas (Cancún, Chihuahua, CDMX, Monterrey, Mérida),
inventario compartido y un sistema de recomendación híbrido **explicable y ajustable
por el negocio**.

- **Backend**: Python + FastAPI, Tortoise-ORM + Aerich, SQLite, Pydantic v2, Uvicorn,
  OpenTelemetry. Arquitectura por capas (domain / infrastructure / api).
- **Datos**: `products.csv` (28 productos) y `sales.csv` (42 tickets históricos).
  Mérida no tiene historial de ventas — caso de arranque en frío intencional.

---

## Cómo ejecutar

Requisitos: Python 3.13 y [uv](https://docs.astral.sh/uv/).

```bash
uv sync                       # instala dependencias
uv run aerich upgrade         # aplica migraciones (crea backend/data/ferreteria.db)
uv run python -m backend.app.scripts.seed   # carga products.csv y sales.csv
uv run uvicorn backend.app.main:app --reload  # API en http://localhost:8000
```

- Docs interactivas: http://localhost:8000/docs
- Verificar: `uv run pytest`, `uv run ruff check backend`

> Si el archivo SQLite no existe al arrancar, el servidor genera el esquema
> automáticamente (POC-friendly). La fuente de verdad de esquema son las
> migraciones Aerich (`backend/migrations/`).

## Stack y decisiones

| Herramienta | Uso | Nota |
|---|---|---|
| Tortoise-ORM | ORM asíncrono | Tortoise usa **Aerich** para migraciones; Alembic es de SQLAlchemy y no aplica aquí (documentado, no omitido). |
| SQLite (aiosqlite) | Base de datos | Simplicidad del POC; el puerto de repositorios aísla el cambio a PostgreSQL. |
| Pydantic v2 + pydantic-settings | Schemas y configuración | |
| OpenTelemetry | Traces (FastAPI auto + spans manuales) y métricas | Consola opt-in (`OTEL_CONSOLE=true`); OTLP/gRPC vía `OTLP_ENDPOINT`. |
| pytest + pytest-asyncio + httpx | Pruebas | 49 pruebas: unitarias (dominio) e integración (API). |

## Arquitectura por capas

```
backend/app/
├── domain/               # Reglas de negocio puras (sin frameworks)
│   ├── entities.py       # Product, Store, SaleRow, RecommendationRule, BlendWeights…
│   ├── ports.py          # Interfaces de repositorios (Protocols)
│   ├── errors.py         # Errores de dominio → códigos HTTP
│   └── services/         # catalog, inventory, purchasing, recommender/*, evaluation
├── infrastructure/       # Tortoise-ORM, repositorios, carga de CSVs
├── api/                  # Rutas FastAPI + schemas Pydantic (frontera HTTP)
├── scripts/              # seed.py, evaluate.py
└── main.py               # Composición (factory + lifespan + CORS + OTel)
```

Reglas clave del negocio, aisladas en `domain/`:

1. **El inventario nunca se sobre-vende.** El repositorio de compras ejecuta cada
   línea con un `UPDATE … SET stock = stock - qty WHERE stock >= qty` dentro de una
   única transacción; si alguna línea falla, todo el ticket se revierte (all-or-nothing).
   Verificado con una prueba de concurrencia: 20 compras simultáneas sobre stock 3 →
   exactamente 3 exitosas.
2. **Una compra es un ticket multi-línea**, deduplicado por SKU y validado contra el
   catálogo antes de tocar la base.
3. **Solo se recomiendan productos con stock > 0**, y nunca productos ya en el carrito.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/api/products`, `/api/products/{sku}` | CRUD de catálogo |
| PATCH/DELETE | `/api/products/{sku}` | Actualizar / eliminar |
| GET | `/api/stores` | Las 5 tiendas |
| GET | `/api/stores/{id}/sales` | Historial de ventas por tienda |
| POST | `/api/stores/{id}/purchases` | Compra multi-línea (atómicamente descuenta inventario) |
| GET | `/api/recommendations?store_id=&cart=SKU001,SKU004&limit=5` | Recomendaciones con desglose de puntaje |
| GET | `/api/recommendations/explain?source=&target=&store_id=` | Explicación de un par (similitud, soporte, lift) |
| GET/POST/DELETE | `/api/rules` | Reglas del negocio (boost/block, globales o por tienda) |
| GET | `/api/rules/discovered` | Pares descubiertos (lift + similitud de contenido) |
| GET/PUT | `/api/stores/{id}/weights` | Pesos de mezcla por tienda |
| GET | `/api/evaluation?split_date=&k=` | Evaluación offline completa |

## Sistema de recomendación (híbrido estadístico)

Dado un carrito (1+ SKUs) y una tienda, el motor combina tres señales con pesos
por tienda (ajustables en la UI del negocio):

1. **Co-ocurrencia** (market-basket): coseno sobre la matriz de incidencia
   ticket×producto de las ventas de todas las tiendas. "Quien compró X también
   compró Y". Agrupamos tiendas porque 9–12 SKUs por tienda son insuficientes
   para aprender pares aislados.
2. **Contenido** (TF-IDF): coseno sobre tokens de `nombre + categoria + material +
   uso_recomendado`. Cubre arranque en frío (Mérida, SKUs nuevos). La `descripcion`
   se excluye deliberadamente: en la evaluación empírica diluía la señal
   (HR@5 bajaba de 0.625 a 0.594).
3. **Popularidad** por tienda con respaldo global, log-escalada y normalizada.

Post-procesamiento: filtro de stock, exclusión del carrito y reglas del negocio
(bloquear un par, potenciar con multiplicador, global o por tienda). Cada
recomendación incluye el desglose de su puntaje y razones legibles
("Se ha comprado junto a SKU004 en 2 tickets"), que alimentan la pantalla de
"relationship manager".

Pesos por defecto: `w_cooccurrence=0.3, w_content=0.9, w_popularity=0.1`
(dominados por contenido, coherente con los datos actuales). El negocio los
ajusta por tienda; el motor se reconstruye por request (28 productos / ~200
ventas lo hacen trivial) y siempre refleja ventas y reglas al día. A escala
productiva esto se vuelve un índice cacheado con reconstrucción incremental.

## Verificación (evaluación offline)

Metodología — split temporal + leave-one-out por ticket:

1. Entrenar con tickets anteriores a `split_date`; evaluar con el resto
   (simula recomendar solo con conocimiento del pasado).
2. Para cada ticket de test y cada producto del ticket, pedir Top-K dado ese
   producto; la verdad es el resto del ticket.
3. Métricas: **HitRate@K**, **Precision@K**, **Cobertura** (fracción del catálogo
   recomendada alguna vez — evita motores "top-seller" que ignoran el catálogo).
4. Ablación de cada señal + híbrido vs. baselines (aleatorio, popularidad global).

Resultados con el dataset entregado (split 2026-03-05, K=5):

```
Estrategia             HitRate  Precision  Cobertura
random                  15.6%      3.1%     100.0%
popularity_baseline      9.4%      1.9%      21.4%
cooccurrence            31.3%      6.3%      92.9%
content                 59.4%     11.9%     100.0%
hybrid                  46.9%      9.4%     100.0%
```

Conclusiones honestas:
- La señal de **contenido** domina (59.4% HR@5) porque los atributos del catálogo
  codifican bien las relaciones de proyecto (soldadura, plomería, exterior-costero…)
  y el historial es pequeño (42 tickets, solo 8 pares repetidos).
- El híbrido con pesos por defecto queda debajo del contenido puro: con esta
  cantidad de datos, mezclar diluye. Por eso los pesos son ajustables por tienda
  y la evaluación es una tabla de ablación, no un número afinado sobre datos
  diminutos (el tuning de pesos sobre 26 tickets es ruido).
- La cobertura del híbrido (100%) muestra que no colapsa en los mismos productos.
- **Caveat**: 32 consultas de test son direccionales, no concluyentes. Con volumen
  real el mismo harness soporta NDCG, significancia por tienda y CTR online
  (eventos de clic sobre recomendaciones).

Ejecutar: `uv run python -m backend.app.scripts.evaluate` o
`GET /api/evaluation?split_date=2026-03-05&k=5`.

## Frontend

Pendiente (siguiente etapa): React + TypeScript con selector de tienda, catálogo
con CRUD, carrito/compra con panel de recomendaciones explicables, pantalla de
relaciones (boost/block, pesos por tienda) y vista de evaluación.

## Qué quedaría pendiente a escala productiva

- Autenticación/autorización (ninguna por ahora, fuera de alcance del POC).
- Índice del recomendador cacheado con reconstrucción incremental (en lugar de
  rebuild por request).
- Tracking de CTR sobre recomendaciones para validación online.
- SQLite → PostgreSQL: solo cambia la URL y el driver; los puertos aíslan el resto.
- Stock histórico por fecha para evaluación (hoy se usa el stock actual).
