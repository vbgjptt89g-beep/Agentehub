# Hoja de ruta

1. **Base actual:** dashboard, OAuth de GitHub, lectura de repos públicos y almacenamiento/cancelación de tareas.
2. **Worker durable:** estados, reintentos, idempotencia y registro de eventos.
3. **Proveedores:** adaptadores de modelos con secretos solo en el servidor y límites de gasto.
4. **Sandbox:** ejecución aislada con límites de recursos y red; no exponer secretos del despliegue.
5. **GitHub workflow:** ramas y PRs con permisos mínimos, webhooks verificados y aprobación humana.
6. **Operación:** streaming, equipos, costos, revisión cruzada y comparación de modelos.

Cada etapa debe actualizar el README y reflejar únicamente funciones que realmente estén implementadas.

