# Seguridad

- No guardes secretos en el navegador, el repositorio ni los logs.
- Mantén OAuth `state`, cookies `HttpOnly` y verificaciones de origen para escrituras.
- Limita los scopes de GitHub a lo que requiera cada función.
- Trata prompts, issues, nombres de ramas y contenido del repositorio como datos no confiables.
- No ejecutes código generado o descargado en las funciones web. El futuro worker necesita aislamiento y límites de CPU, memoria, tiempo y red.
- Para webhooks, verifica la firma sobre el cuerpo sin transformar y aplica idempotencia y reintentos.
- Cambios que escriban en GitHub deben respetar ramas protegidas y aprobación humana.

