# Guía para agentes de código

- Lee `README.md`, `docs/ARCHITECTURE.md` y `docs/SECURITY.md` antes de cambiar flujos de autenticación o ejecución.
- No inventes datos de actividad, costos, tests ni estado de agentes en la interfaz.
- No muevas las funciones `api/` fuera de la raíz sin cambiar y comprobar la configuración de Vercel.
- No ejecutes código de repositorios en el proceso web ni expongas secretos al navegador.
- Mantén los estados y opciones compartidos en `shared/constants.js`.
- Describe en el README qué está implementado y qué sigue pendiente.

