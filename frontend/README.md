# Frontend — Ferretería Multi-Tienda

Panel React + Vite (JSX) para la API FastAPI del proyecto. Estilos con
Tailwind CSS v4 y shadcn/ui (layout `dashboard-01` adaptado).

## Comandos

```bash
npm install      # dependencias (o python bootstrap.py --web desde la raíz)
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run lint     # eslint
npm run build    # build de producción
```

La API debe estar corriendo en `http://localhost:8000` (ver `README.md` de la raíz).
La URL de la API se configura con `VITE_API_URL` (default `http://localhost:8000/api`);
ver `.env.example`.

## Estructura

- `src/lib/api.js` — única frontera HTTP (axios) + helpers por recurso.
- `src/context/store-context.jsx` — tiendas y tienda activa (compartida).
- `src/components/` — shell (sidebar, header, chart, tabla genérica) y `ui/` (shadcn).
- `src/sections/` — Dashboard, Productos, Ventas, Compras, Recomendaciones, Reglas,
  Evaluación.

## shadcn

`components.json` tiene `tsx:false`: `npx shadcn@latest add <component>` genera `.jsx`.
No borres `toggle`, `toggle-group` ni `sheet` (los usan el chart y el sidebar).
