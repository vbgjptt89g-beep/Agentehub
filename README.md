# AgentHub

AgentHub reúne repositorios, issues, pull requests y tareas de agentes de código en un solo centro de trabajo. Esta versión combina un dashboard web responsive, GitHub OAuth y una cola de tareas persistida en PostgreSQL.

> Las tareas se guardan y se pueden cancelar mientras siguen pendientes. El worker que las ejecutará, los proveedores de modelos y el sandbox todavía están en desarrollo; crear una tarea no ejecuta código ni abre un pull request.

## Funciones disponibles

- Iniciar y cerrar sesión con GitHub OAuth.
- Consultar repositorios públicos, ramas, issues abiertos y pull requests del usuario.
- Guardar tareas por usuario y repositorio en PostgreSQL, con el modelo y el issue asociado.
- Consultar y cancelar tareas que sigan en estado `queued`.
- Dashboard adaptable a móvil con estados vacíos, resumen de GitHub y vistas de repositorios, tareas y PRs.
- Sesiones cifradas en cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción y protección `state` durante OAuth.

## Estado del proyecto

| Área | Estado |
| --- | --- |
| Interfaz y navegación | Disponible |
| Lectura de GitHub | Disponible para repositorios públicos |
| Persistencia de tareas | Disponible con PostgreSQL y `DATABASE_URL` |
| Cancelación de tareas pendientes | Disponible |
| Ejecución de agentes y cola de workers | Pendiente |
| Anthropic, OpenAI y modelos locales | Pendiente |
| Sandbox de código, tests y streaming de logs | Pendiente |
| Creación de ramas, commits y pull requests por agentes | Pendiente |
| Equipos, costos y gestión de claves | Pendiente |

## Requisitos

- Node.js 20 o posterior.
- Una GitHub OAuth App.
- PostgreSQL compatible con Neon para habilitar la cola persistente.
- Una cuenta de Vercel para desplegar con funciones serverless.

## Configuración local

1. Clona el repositorio y crea `.env` a partir de `.env.example`.
2. Crea una GitHub OAuth App. Para desarrollo, configura el callback `http://localhost:3000/api/auth/callback`.
3. Completa las variables de entorno:

```text
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/api/auth/callback
AGENTHUB_SESSION_SECRET=
DATABASE_URL=
```

Genera el secreto de sesión con:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Instala las dependencias y arranca las funciones locales de Vercel:

```sh
npm install
npx vercel dev
```

Si no configuras `DATABASE_URL`, las vistas de GitHub siguen disponibles, pero las rutas de tareas responden con `503` y el dashboard indicará que falta la base de datos.

## Despliegue en Vercel

1. Importa el repositorio en Vercel con el framework **Other** y raíz `/`.
2. Añade Neon Postgres desde Vercel Marketplace o conecta una base Neon existente; verifica que el proyecto tenga `DATABASE_URL`.
3. Configura `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_CALLBACK_URL`, `AGENTHUB_SESSION_SECRET` y `DATABASE_URL` para Preview y Production.
4. En la GitHub OAuth App, configura el callback exacto del dominio de Vercel: `https://TU-DOMINIO/api/auth/callback`.
5. Despliega y conecta GitHub desde el dashboard.

La tabla e índice de tareas se crean de forma idempotente en la primera petición autenticada a `/api/tasks`.

## API

Todas las rutas de GitHub y tareas requieren una sesión activa.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/auth/login` | Inicia el flujo OAuth de GitHub. |
| `GET` | `/api/auth/callback` | Valida `state`, intercambia el código y crea la sesión. |
| `GET` | `/api/auth/me` | Devuelve el usuario y los scopes concedidos. |
| `POST` | `/api/auth/logout` | Revoca el grant de OAuth e invalida la cookie local. |
| `GET` | `/api/github/repos` | Lista repositorios públicos accesibles por el usuario. |
| `GET` | `/api/github/branches?repo=owner/name` | Lista ramas del repositorio. |
| `GET` | `/api/github/issues?repo=owner/name` | Lista issues abiertos, sin incluir PRs. |
| `GET` | `/api/github/pulls?repo=owner/name` | Lista pull requests abiertos. |
| `GET` | `/api/tasks?repo=owner/name` | Lista las tareas del usuario; el filtro `repo` es opcional. |
| `POST` | `/api/tasks` | Valida el repositorio e inserta una tarea en `queued`. |
| `PATCH` | `/api/tasks?id=<uuid>` | Cancela una tarea del usuario que aún esté `queued`. |

La creación de tareas acepta JSON con `title`, `prompt`, `repository`, `model` y el `issue` opcional. Solo acepta repositorios públicos en esta entrega. Las peticiones de escritura se limitan al mismo origen.

## Seguridad y límites actuales

- OAuth solicita `read:user,public_repo`; no concede lectura de repositorios privados.
- No se envían claves de proveedores al navegador ni se ejecutan comandos del repositorio.
- `DATABASE_URL` es una variable exclusivamente de servidor y no debe usar prefijo `NEXT_PUBLIC_`.
- Los modelos que aparecen en el selector solo se guardan como preferencia; no hay llamadas a Anthropic u OpenAI hasta implementar los proveedores.
- La cola no arranca tareas automáticamente. El estado `queued` significa pendiente de worker, no que un agente ya esté trabajando.
- No hay métricas de costo ni resultados de tests simulados en el dashboard.

## Estructura

```text
.github/
  workflows/ci.yml       Validación de sintaxis y configuración
  pull_request_template.md
assets/                   Recursos gráficos
api/
  auth/       OAuth y sesión
  github/     Lectura de datos de GitHub
  tasks/      Cola persistente y cancelación
backend/                  Notas de organización del backend Vercel
docs/                     Arquitectura, seguridad y hoja de ruta
frontend/                 Notas de organización de la interfaz
lib/
  database.js       Conexión Neon y esquema de tareas
  github-session.js Sesiones cifradas y cliente de GitHub
scripts/check-project.js  Validación estática local y de CI
shared/                   Constantes compartidas
tests/                    Guía para la futura suite automatizada
index.html          Aplicación web
styles.css          Estilos base
ui-states.css       Estados de interfaz
notion.css          Tema claro inspirado en la referencia Notion
app.js              Navegación e integración del dashboard
CLAUDE.md            Contexto y límites para agentes de código
vercel.json          Cabeceras y política de seguridad
```

Las carpetas `frontend/` y `backend/` documentan las áreas del producto. Los archivos desplegables se mantienen en la raíz y en `api/`, como requiere la configuración serverless actual de Vercel.

## Próximas etapas

1. Añadir un worker durable que consuma tareas y registre eventos y resultados.
2. Conectar proveedores de IA con claves del servidor y límites de gasto.
3. Ejecutar comandos y tests dentro de Vercel Sandbox con políticas de red restrictivas.
4. Crear ramas, commits y PRs con permisos mínimos y aprobaciones humanas.
5. Añadir streaming de logs, revisión cruzada, webhooks y soporte para equipos.

