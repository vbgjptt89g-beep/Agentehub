# AgentHub

Centro de mando web para conectar GitHub y preparar trabajo de agentes de código.

## Estado de esta primera entrega

- Dashboard responsive con vistas de repositorios, issues y pull requests.
- OAuth de GitHub con `state` anti-CSRF y sesión cifrada en cookie `HttpOnly`, `Secure` en producción y `SameSite=Lax`.
- Endpoints serverless de solo lectura para repositorios, ramas, issues y PRs.
- Las tareas creadas desde la interfaz todavía son demostraciones locales. Aún no hay base de datos, cola durable, proveedores de IA ni sandbox de ejecución.
- La conexión solicita el scope `public_repo`; esta entrega puede leer y escribir en repositorios públicos autorizados por el usuario. No solicita acceso a repositorios privados.

## Preparar GitHub OAuth

1. Crea una GitHub OAuth App en GitHub Developer Settings.
2. Configura su **Authorization callback URL** como `https://TU-DOMINIO/api/auth/callback` (para desarrollo: `http://localhost:3000/api/auth/callback`).
3. Copia el Client ID y genera un Client Secret.
4. Añade estas variables al entorno del despliegue:

```text
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_OAUTH_CALLBACK_URL=https://TU-DOMINIO/api/auth/callback
AGENTHUB_SESSION_SECRET=<secreto aleatorio de 32 o más caracteres>
```

Puedes generar `AGENTHUB_SESSION_SECRET` con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Nunca publiques `.env` ni el Client Secret. El archivo `.env.example` no contiene credenciales.

## Vercel

El repo está preparado como sitio estático con funciones Node en `api/`. Importa el repo en Vercel, deja el framework como **Other** y la raíz del proyecto en `/`. Añade las cuatro variables de entorno anteriores para Preview y Production; configura el callback de GitHub para el dominio donde probarás OAuth. Vercel publicará el HTML, CSS y JS estáticos y servirá las funciones API.

## Rutas API

- `GET /api/auth/login` — inicia OAuth.
- `GET /api/auth/callback` — valida `state`, intercambia el código y cifra la sesión.
- `GET /api/auth/me` — usuario conectado y scopes autorizados.
- `POST /api/auth/logout` — cierra la sesión local.
- `GET /api/github/repos` — repos públicos accesibles por la cuenta.
- `GET /api/github/branches?repo=owner/name`
- `GET /api/github/issues?repo=owner/name`
- `GET /api/github/pulls?repo=owner/name`

## Próximas etapas

1. Persistir usuarios, conexiones y ejecuciones en PostgreSQL.
2. Sustituir OAuth App por GitHub App con permisos mínimos y webhooks firmados.
3. Conectar proveedores Anthropic/OpenAI con claves cifradas del servidor.
4. Añadir workers y una cola durable; ejecutar herramientas dentro de sandboxes efímeros con límites de CPU, memoria y red.
5. Streaming, cancelación, ramas/commits/PRs, revisión cruzada y registro de costos.

