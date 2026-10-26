# Barak · Sistema de barbería

Versión adaptada de The Barber, con logo oficial Barak, interfaz blanca y negra, bolivianos y zona America/La_Paz. Conserva acceso libre y selector de perfiles. Cualquier persona con acceso al sitio puede consultar y modificar datos; el selector no es autenticación.

## Datos independientes
El servidor utiliza exclusivamente `tenants/barak/state/current` y su historial en `tenants/barak/stateAudit`. No carga ni borra los espacios de otras barberías. El primer ingreso crea un estado vacío; las siguientes publicaciones conservan lo registrado. No reutilices este identificador para otro cliente.

## Publicación completa en Netlify
1. Descomprime este ZIP y abre una terminal en la carpeta Barak-Barberia, donde está netlify.toml.
2. Usa Node.js 22 o superior. Ejecuta `npm ci`.
3. Ejecuta `npx netlify-cli login` y `npx netlify-cli init`. Crea un sitio NUEVO para Barak; no selecciones el sitio de otra barbería.
4. En la configuración privada de variables de entorno del nuevo sitio agrega `FIREBASE_SERVICE_ACCOUNT_JSON`, con el JSON de una cuenta de servicio autorizada para la base de datos elegida. Nunca agregues esa clave a archivos públicos ni al ZIP.
5. Ejecuta `npx netlify-cli deploy --build --prod` desde esta carpeta. La carpeta pública es `public` y las funciones están en `netlify/functions`.
6. Abre el sitio y verifica guardado y lectura desde un segundo dispositivo. Sin la variable privada y las funciones desplegadas, el sistema no puede guardar.

Arrastrar solamente public a Netlify no despliega el servicio de datos. Esta entrega no implica que el sitio ya esté publicado ni que la conexión real haya sido comprobada.

## Funciones conservadas
Agenda, horarios por profesional, clientes, fidelización de nueve visitas, anticipos, pagos, caja, propinas, salarios, descuentos, retiro de barberos, reportes y exportaciones. Inventario y venta de productos permanecen como en el proyecto base. La tarjeta compartida es una copia al momento del envío; no se actualiza sola. El canje del premio no tiene control automático.

## Verificación
`npm test` ejecuta la suite local. Las pruebas con emuladores requieren dependencias y configuración adicional. Las pruebas locales no sustituyen comprobar la conexión real tras publicar.
