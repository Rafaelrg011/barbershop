# Revisión vigente · 19/10/2026

Por solicitud expresa se eliminó el ingreso y la habilitación de equipos. La función public-state permite lectura y escritura del estado de piloto sin autenticar al visitante. Esto elimina la confidencialidad y el control individual de acceso a esos registros. Los perfiles de la interfaz son vistas, no barreras de seguridad.

Se mantienen validaciones financieras, control de revisiones, límite de tamaño y claves de servicio exclusivamente en el servidor. La función pública no administra usuarios de Firebase ni permite seleccionar otra barbería por parámetros. Los cambios se registran con actor public-access.

37 pruebas locales aprobadas con servicios simulados. Despliegue real, pruebas entre dispositivos y verificación visual en navegador pendientes. No hay garantía de funcionamiento al 100%. Consulta LEEME.md para publicación y reversión del acceso público.
