# Frontend

La interfaz se publica desde la raíz para conservar la configuración estática actual de Vercel.

- `index.html`: estructura y vistas del dashboard.
- `app.js`: navegación y llamadas a la API.
- `styles.css`, `ui-states.css`, `notion.css`: estilos base, estados y tema visual.
- `assets/`: recursos estáticos del producto.

Si el frontend se migra a un framework, coordina el cambio con `vercel.json` y las rutas serverless de `api/`.

