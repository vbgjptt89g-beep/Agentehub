# Arquitectura actual

```text
Navegador
  ├── index.html + app.js + CSS
  └── API de Vercel (/api/*)
        ├── OAuth y sesión GitHub (lib/github-session.js)
        ├── lectura de GitHub (api/github/*)
        └── tareas persistentes (api/tasks/* → Neon/PostgreSQL)
```

Vercel sirve la interfaz y las funciones API desde el mismo proyecto. La sesión OAuth se mantiene en una cookie cifrada de servidor. La base de datos guarda tareas pendientes; todavía no existe cola durable ni proceso worker.

## Límites de la arquitectura actual

- OAuth y lectura están limitados a repositorios públicos.
- Las tareas se guardan y cancelan mientras están pendientes, pero no se ejecutan.
- No hay adaptadores de modelos, sandbox, streaming, webhooks ni creación automática de PR.
- `backend/` y `frontend/` documentan responsabilidades; las rutas desplegables permanecen en la raíz compatible con Vercel.

