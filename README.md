# Ferretería Multi-Tienda — Inventario Compartido + Sistema de Recomendación

POC de una cadena ferretera con 5 tiendas (Cancún, Chihuahua, CDMX, Monterrey, Mérida),
inventario compartido y un sistema de recomendación híbrido **explicable y ajustable
por el negocio**.

- **Backend**: Python + FastAPI, Tortoise-ORM + Aerich, SQLite, Pydantic v2, Uvicorn,
  OpenTelemetry. Arquitectura por capas (domain / infrastructure / api).
- **Frontend**: React + Vite (JSX), Tailwind CSS v4 + shadcn/ui (layout `dashboard-01`),
  react-router, sonner para toasts. `src/lib/api.js` es la única frontera HTTP.
- **Datos**: `products.csv` (28 productos) y `sales.csv` (42 tickets históricos).
  Mérida no tiene historial de ventas — caso de arranque en frío intencional.

---

## Cómo ejecutar

### 1. Inicialización desde cero (recomendado)

Requisito: **Python 3.13**. El frontend además requiere **Node.js 18+** (solo para `--web`
y el paso manual de `npm install`):

```bash
python bootstrap.py --web
```

Qué hace, en orden:

1. Detecta `uv` y, si no existe, lo instala (`pip install --user uv`) y agrega
   su directorio al PATH del usuario.
2. `uv sync` — crea el entorno virtual e instala dependencias.
3. `uv run aerich upgrade` — aplica migraciones (crea `backend/data/ferreteria.db`).
4. `uv run python -m backend.app.scripts.seed` — carga `products.csv` y `sales.csv`.
5. `npm install` (solo con `--web`) — instala las dependencias del frontend.

Opciones:

```bash
python bootstrap.py --fresh            # ademas borra la SQLite local (arranque de cero)
python bootstrap.py --no-seed          # ademas salta la carga de productos/ventas
python bootstrap.py --test             # ademas ejecuta las 55 pruebas
python bootstrap.py --run              # ademas arranca la API al final (--host/--port)
python bootstrap.py --web              # ademas instala las dependencias del frontend
python bootstrap.py --fresh --run --web  # cero + arrancar + frontend listo
```

> **Windows**: si el script instaló `uv` o lo agregó al PATH, abre una **terminal
> nueva** antes de usar el comando `uv` directamente.

### 2. Arrancar la API

```bash
uv run uvicorn backend.app.main:app --reload
```

- Docs interactivas: http://localhost:8000/docs
- Verificar: `uv run pytest`, `uv run ruff check backend`

### 3. Arrancar el frontend

```bash
cd frontend
npm install   # solo la primera vez (o python bootstrap.py --web desde la raíz)
npm run dev
```

- Panel: http://localhost:5173 (la API debe estar corriendo en :8000)
- La URL de la API se configura con `VITE_API_URL` (`.env.example`; default
  `http://localhost:8000/api`). CORS ya permite ese origen.
- Calidad: `npm run lint`, `npm run build` (desde `frontend/`).

Secciones del panel (ver `frontend/src/sections/`): **Dashboard** (tarjetas de
resumen + ventas por fecha + ventas recientes), **Productos** (CRUD de catálogo),
**Ventas** (historial por tienda + importación), **Compras** (ticket multi-línea con
recibo y sugerencias top-K explicables que se generan solas al elegir productos),
**Reglas** (boost/block, pesos del blend, parejas descubiertas) y **Evaluación**
(reporte offline). El selector de tienda del sidebar comparte el estado con la app
(`store-context.jsx`), y toda mutación muestra un toast con el mensaje de éxito o
el `detail` del error. `/recomendaciones` redirige a `/compras`.

### 4. Cargar datos vía endpoints de negocio (alternativa al seed CLI)

El seed CLI escribe directo en SQLite. Si prefieres registrar los datos
**a través de la app** (operaciones reales de negocio), usa el script de
importación con el servidor corriendo:

```bash
uv run python -m backend.app.scripts.import_data
```

Qué hace, por endpoints de negocio:

1. `GET /api/stores` + `POST /api/stores` — crea las 5 tiendas que falten.
2. `POST /api/products` por cada fila de `products.csv` (28; 409 = ya existe, se salta).
3. `POST /api/stores/{id}/sales/import` — registra el histórico de `sales.csv`
   con su fecha original y **sin tocar stock** (el stock solo lo mueven las
   compras). Idempotente: re-ejecutarlo no duplica nada.

Para probarlo desde cero: `python bootstrap.py --fresh --no-seed` (deja la base
vacía), arranca la API y ejecuta el script.

### 5. Equivalente manual (paso a paso, sin bootstrap)

```bash
uv sync                       # instala dependencias
uv run aerich upgrade         # aplica migraciones (crea backend/data/ferreteria.db)
uv run python -m backend.app.scripts.seed   # carga products.csv y sales.csv
uv run uvicorn backend.app.main:app --reload  # API en http://localhost:8000
```

> Si el archivo SQLite no existe al arrancar, el servidor genera el esquema
> automáticamente (POC-friendly). La fuente de verdad de esquema son las
> migraciones Aerich (`backend/migrations/`).

### 6. Probar con Postman

Importa `postman/ferreteria-happy-path.postman_collection.json` y ejecuta la
colección en orden: cubre el happy path completo (catálogo, compra, histórico,
recomendaciones, reglas, pesos y evaluación) con aserciones de status code.
Los IDs de tienda se capturan dinámicamente de `GET /api/stores`, así que
funciona sin importar cuántas veces se haya re-seedado la base.

## Stack y decisiones

| Herramienta | Uso | Nota |
|---|---|---|
| Tortoise-ORM | ORM asíncrono | Tortoise usa **Aerich** para migraciones; Alembic es de SQLAlchemy y no aplica aquí (documentado, no omitido). |
| SQLite (aiosqlite) | Base de datos | Simplicidad del POC; el puerto de repositorios aísla el cambio a PostgreSQL. |
| Pydantic v2 + pydantic-settings | Schemas y configuración | |
| OpenTelemetry | Traces (FastAPI auto + spans manuales) y métricas | Consola opt-in (`OTEL_CONSOLE=true`); OTLP/gRPC vía `OTLP_ENDPOINT` requiere instalar el exportador opcional `opentelemetry-exporter-otlp-proto-grpc` (sin él solo se registra un warning). |
| React 19 + Vite | Frontend SPA (JSX) | react-router-dom para rutas; `VITE_API_URL` apunta a la API. |
| Tailwind v4 + shadcn/ui | Estilos y componentes | Layout `dashboard-01` adaptado; CLI v4 con preset `radix-nova` y `tsx:false`. |
| sonner + axios | Toasts y HTTP | `src/lib/api.js` es la única frontera HTTP del frontend. |
| pytest + pytest-asyncio + httpx | Pruebas | 55 pruebas: unitarias (dominio) e integración (API). |

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
| GET | `/api/health` | Estado del servicio |
| GET/POST | `/api/products`, `/api/products/{sku}` | CRUD de catálogo |
| PATCH/DELETE | `/api/products/{sku}` | Actualizar / eliminar |
| GET/POST | `/api/stores` | Las 5 tiendas / alta de tienda |
| GET | `/api/stores/{id}/sales` | Historial de ventas por tienda |
| POST | `/api/stores/{id}/sales/import` | Importar histórico de ventas (insert-only, no toca stock, idempotente por ticket) |
| POST | `/api/stores/{id}/purchases` | Compra multi-línea (atómicamente descuenta inventario) |
| GET | `/api/recommendations?store_id=&cart=SKU001,SKU004&limit=5` | Recomendaciones con desglose de puntaje |
| GET | `/api/recommendations/explain?source=&target=&store_id=` | Explicación de un par (similitud, soporte, lift) |
| GET/POST | `/api/rules` | Reglas del negocio (boost/block, globales o por tienda) |
| DELETE | `/api/rules/{rule_id}` | Eliminar una regla |
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
ajusta por tienda; el motor se reconstruye por request (28 productos / 89 ventas
en 42 tickets lo hacen trivial) y siempre refleja ventas y reglas al día. A escala
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
random                  25.0%      5.0%     100.0%
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

React + Vite en JSX (sin TypeScript), Tailwind CSS v4 y shadcn/ui (layout `dashboard-01`
adaptado). Estructura:

```
frontend/src/
├── lib/api.js                 # axios: única frontera HTTP (VITE_API_URL)
├── lib/format.js              # formatos MXN, fechas, porcentajes
├── context/store-context.jsx  # tiendas + tienda activa (compartida en toda la app)
├── components/
│   ├── app-sidebar.jsx        # sidebar: marca, selector de tienda, navegación
│   ├── site-header.jsx        # título de sección
│   ├── sales-chart.jsx        # ventas por fecha (7d/30d/todo)
│   ├── data-table.jsx         # tabla genérica con paginación
│   └── ui/                    # componentes shadcn generados (JSX)
├── sections/                  # Dashboard, Productos, Ventas, Compras,
│                              # Reglas, Evaluación (Recomendaciones vive
│                              # dentro de Compras)
└── App.jsx / main.jsx         # shell (SidebarProvider + rutas) + Toaster
```

Comportamiento:

- Selector de tienda global (sidebar); la tienda activa se persiste en
  `localStorage`. "Nueva tienda" crea una vía `POST /api/stores`.
- En Compras, al elegir productos del ticket se generan solas las sugerencias
  (top-5 explicable) con botón para agregarlas al ticket. `/recomendaciones` redirige
  a `/compras`.
- Todas las mutaciones (CRUD de productos, compras, import de ventas, reglas, pesos)
  muestran toasts sonner: éxito o el `detail` del error del backend (p. ej. el 409 de
  stock insuficiente en compras).
- Estados de carga (skeletons), error (con reintentar) y vacío en todas las secciones
  (Mérida sin ventas es el caso vacío intencional).
- `npm run dev` (5173), `npm run lint`, `npm run build`. La API debe correr en :8000;
  para regenerar componentes: `npx shadcn@latest add <component>` (emite `.jsx`).

## Qué quedaría pendiente a escala productiva

- Autenticación/autorización (ninguna por ahora, fuera de alcance del POC).
- Índice del recomendador cacheado con reconstrucción incremental (en lugar de
  rebuild por request).
- Tracking de CTR sobre recomendaciones para validación online.
- SQLite → PostgreSQL: solo cambia la URL y el driver; los puertos aíslan el resto.
- Stock histórico por fecha para evaluación (hoy se usa el stock actual).
