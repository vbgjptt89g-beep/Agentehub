# Pruebas

Ejecuta `npm test` para probar los flujos críticos con el test runner integrado de Node.js. La suite cubre cifrado de sesiones, callback OAuth, protección CSRF en el cierre de sesión, aislamiento de tareas por usuario, validación de instrucciones y manejo seguro de errores de base de datos.

Estas pruebas no requieren credenciales de GitHub ni conexión a PostgreSQL. Las llamadas externas y la base se sustituyen por dobles controlados en cada prueba.

