# Backend

El backend actual usa funciones serverless de Vercel. Los endpoints viven en `api/` para que Vercel los publique automáticamente; la lógica común vive en `lib/` y los contratos compartidos en `shared/`.

## Módulos

- `api/auth/`: inicio, callback, sesión y cierre de GitHub OAuth.
- `api/github/`: lectura de repositorios, ramas, issues y pull requests.
- `api/tasks/`: persistencia y cancelación de tareas pendientes.
- `lib/github-session.js`: cookies cifradas y cliente de GitHub.
- `lib/database.js`: conexión Neon y esquema PostgreSQL.

Las tareas se almacenan como `queued`; aún no hay un worker que las ejecute. No se deben aceptar comandos ni ejecutar código de repositorios hasta implementar aislamiento, límites y permisos explícitos.

