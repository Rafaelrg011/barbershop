## Horarios por día
Propietario > Equipo > Editar horario: configura entrada, salida, descanso opcional y día libre para cada día de la semana. Los horarios anteriores se muestran como estaban. La disponibilidad y la validación del servidor usan el horario del día correspondiente. No permite dejar citas pendientes fuera de la nueva jornada. Publica navegador y funciones juntos.

## Agenda de barberos y fidelización
En Perfil está disponible Barbero, con Agenda, Clientes y Servicios. Puede elegir el profesional al agendar y filtrar su agenda. Recepción registra los cobros.
Cada cliente dispone de tarjeta con logo oficial, nombre y nueve espacios. Se abre al guardar un cliente nuevo y desde su ficha. Cada cita completada suma un sello; las reservas y cancelaciones no suman. El historial existente también cuenta. La novena atención guardada abre la tarjeta con un mensaje de corte gratis y confeti. Recargar no añade sellos ni vuelve a disparar la celebración.
Esta versión muestra el premio ganado; aún no incorpora un registro de canje ni reinicio de tarjeta.
Se conservan salarios mensuales, propinas y cierres. Publicar el proyecto completo para actualizar navegador y funciones.

## Cierre con entrega de propinas
El arqueo muestra propinas por barbero y medio de pago. Entrega las propinas en efectivo, confirma la entrega y cuenta el dinero restante. Al guardar se registra una salida por cada barbero, sin duplicar entregas. Las propinas digitales se muestran pendientes de entrega y separadas del total del negocio; no descuentan efectivo. El informe descargado conserva el desglose. Los cierres anteriores no se modifican.

# Actualización: salarios mensuales y propinas

- Propietario > Salarios: configurar cuánto cobra al mes cada barbero. También disponible en Equipo.
- Recepción > cita > Cobrar / añadir propina: indicar pago del servicio, propina, nombre del cliente y barbero destinatario.
- Caja y comprobante: servicio y propina se registran en líneas separadas, con total recibido. Las propinas no cancelan deuda del servicio y no son ingresos de servicios en Estadísticas.
- Salarios muestra las propinas por mes y por barbero. Configurar un salario no registra su pago ni retira efectivo de caja.
- Las ventas nuevas no generan comisión. Los registros financieros antiguos se conservan.
- Acceso libre y conexión Firebase conservados. No se añaden datos de ejemplo.

## Actualizar el sitio
Desplegar el proyecto completo, incluyendo public y netlify/functions, con la configuración netlify.toml. Se actualizaron las validaciones compartidas que usa el servidor: publicar solo archivos del navegador no basta. Conservar las variables de entorno existentes en Netlify. Este archivo ZIP contiene el proyecto fuente; no es una publicación ya realizada.

## Verificación
npm test ejecuta las pruebas de guardado, validaciones, salarios y cobros con propinas. Las pruebas locales usan un servidor simulado; comprobar un cobro real después del despliegue.

# The Barber Haircuts & Shaves · Acceso libre

Actualización 19/10/2026, solicitada por el titular. Sustituye las instrucciones anteriores de ingreso.

La web abre desde cualquier dispositivo sin usuario, correo, contraseña ni habilitación del navegador. Recepción y Propietario son vistas seleccionables; no hay separación de permisos entre las personas que abren el enlace. Cualquier visitante puede leer y modificar los registros operativos, incluida la caja y la configuración. No existe identificación individual del autor de los cambios.

## Publicación

1. Extrae el ZIP y actualiza el proyecto completo en el repositorio conectado a Netlify, conservando public, server y netlify/functions. Publicación: public; funciones: netlify/functions. La función public-state es necesaria; subir solo index.html no conecta el guardado.
2. Conserva FIREBASE_SERVICE_ACCOUNT_JSON en las variables del servidor de Netlify. Nunca incluyas esa clave privada en el código público ni en GitHub.
3. Despliega nuevamente. Si Netlify tiene protección propia de acceso, revísala en el panel: el paquete elimina el acceso de la aplicación, no modifica las opciones de tu cuenta Netlify.
4. Abre la web. Debe aparecer la agenda en Recepción y se puede seleccionar Propietario sin formulario. Espera la confirmación de conexión antes de guardar.
5. Registra una cita o apertura de caja, espera la confirmación y recarga. Comprueba también desde otro dispositivo. Esta verificación real sigue pendiente.

No hace falta habilitar Authentication Anónimo ni crear membresías para este modo. No es necesario abrir las reglas de Firestore: el servidor usa la cuenta de servicio y el acceso público deliberado se limita al estado de la barbería piloto. Las funciones antiguas de administración de credenciales mantienen sus comprobaciones y no se presentan en esta interfaz.

## Datos y límites

Se conserva el estado existente de tenants/piloto/state/current. No se eliminan citas al actualizar, no se importan ejemplos ni se usa almacenamiento local como base de datos. Los cambios esperan confirmación del servidor. Ante tiempo agotado, recarga y comprueba antes de repetir. Las revisiones impiden sobrescribir una actualización simultánea.

El estado tiene límite de 750 KB y se consulta cada 15 segundos mientras la pestaña está visible y sin formulario abierto. El informe descargado no es un respaldo restaurable. QR y transferencias son registros manuales, sin verificación bancaria. El perfil individual de Barbero sigue pendiente.

## Verificación

37 pruebas locales aprobadas, incluidas carga sin credenciales, cambio directo a Propietario, guardado y relectura con servidor simulado y validaciones financieras. No equivale a una comprobación en tu cuenta real. Las pruebas con emuladores requieren Java 21; el entorno disponible tiene Java 17.

Para restaurar privacidad debe retirarse la función public-state y volver a exigir permisos en el cliente; cambiar solo las reglas de Firestore no cierra este acceso público de servidor.


Tarjeta compacta y WhatsApp: el botón abre el número guardado del cliente con un mensaje y enlace a loyalty-card.html. El usuario confirma el envío en WhatsApp. El enlace contiene únicamente el nombre, número de visitas y fecha de emisión; es una copia de los sellos al compartir, no una consulta en vivo ni comprobante de canje. La página individual permite descargar PNG. Publicar también loyalty.js y loyalty-public.js.

Diseño renovado: theme.css y theme.js añaden paleta vino/verde, paneles claros, menú plegable en escritorio y móvil. Se conserva el logo oficial y tarjeta de fidelización. Publicar el proyecto completo, incluyendo estos dos archivos.
