# Mi Bolsillo 💰

App web (instalable en el celular) para llevar las finanzas del hogar o de un pequeño negocio:
ingresos y gastos, cheques a cobrar/pagar, presupuestos mensuales y avisos de vencimientos.

Hecha con Next.js 15, React 19, Tailwind, shadcn/ui y Firebase (Authentication + Firestore).

## Qué hace

| Pantalla | Funciones |
|---|---|
| **Ingreso / Registro** | Correo y contraseña, Google (con *fallback* a redirección en celulares), recuperar contraseña, errores en español claro. |
| **Inicio** | Saldo del libro, entró/salió este mes, cheques a cobrar/pagar, gráfico de 6 meses, gastos por categoría, últimos movimientos, próximos cheques, presupuestos y alerta destacada si hay algo vencido. |
| **Movimientos** | Alta / edición / borrado, búsqueda, filtros por tipo, mes y categoría, totales, exportar a CSV (abre bien en Excel). Sugerencia automática de categoría y lectura de tickets con foto (IA, opcional). |
| **Cheques** | A cobrar / a pagar, pendientes e historial, marcar como cobrado/pagado (genera el movimiento automáticamente), rechazado, anulado, volver a pendiente, editar, borrar. |
| **Presupuestos** | Tope mensual por categoría, barra de avance con “ritmo ideal” según el día del mes, avisos al 80 % y al 100 %. |
| **Ajustes** | Perfil, cambiar contraseña, notificaciones (activar, anticipación, resumen semanal, prueba), tema y **tamaño de letra**, instalar la app, libros (renombrar, moneda, crear, eliminar), **personas con acceso** y categorías. |
| **Cuentas** | Efectivo, banco, billeteras, ahorros y tarjetas con su saldo; **transferencias** entre cuentas (también pesos → dólares con la cotización); cuentas en USD valuadas al dólar oficial/blue/MEP (dolarapi.com) o a una cotización propia. |
| **Gastos fijos** | Alquiler, servicios, prepaga, sueldo… Se cargan una vez: o se **anotan solos** el día indicado, o se **recuerdan** y se anotan con un toque ("Ya lo pagué"). |
| **Resumen** | Mensual y anual: ingresos, gastos, resultado, % de ahorro, comparación con el período anterior por categoría, gastos más grandes, mes a mes. **Imprimir / guardar PDF.** |

**Además:**
- **Fotos y PDF adjuntos** (opcionales) en movimientos y cheques: factura, boleta, frente y dorso del cheque. Se comprimen en el teléfono y se guardan en Firebase Storage; sólo las ven los miembros del libro.
- **Funciona sin señal:** se puede anotar sin conexión; queda guardado en el teléfono y se sube solo al volver.
- **Deshacer** al borrar movimientos, cheques, presupuestos, gastos fijos y cuentas.
- **Importar** desde Excel/CSV o el resumen del banco (fechas y montos en formato argentino, débito/crédito, evita duplicados).
- **Compartir un libro** por correo con permiso de edición o sólo lectura; la persona invitada acepta desde la app.

**Libros:** cada usuario puede tener varios (por ejemplo “Casa” y “Negocio”), cada uno con su moneda.
Al registrarse se crea uno automáticamente con categorías listas para usar.

### Notificaciones

- **Campanita** en la app con todos los avisos: cheques vencidos o por vencer (anticipación configurable) y presupuestos al 80 %/superados.
- **Cheques con varios avisos:** en Ajustes → Avisos de cheques se eligen los días de anticipación (30, 15, 10, 7, 5, 3, 2, 1 y el mismo día),
  por separado para cheques a cobrar y a pagar, qué hacer si se vence (una vez, todos los días, cada 2/3 días o semanal) y la
  hora de las notificaciones. Cada cheque puede tener sus propios avisos ("Personalizar avisos"). La función `avisosDiarios`
  corre cada hora y le envía a cada persona sus avisos a la hora elegida.
- **Gastos fijos:** recordatorio el día que toca (o aviso de que se anotó solo).
- **Resumen semanal** los lunes 9:30 (función `resumenSemanal`), desactivable desde Ajustes.
- **Avisos con la app cerrada (push):** la Cloud Function `avisosDiarios` (`functions/`) corre todos los días a las 9:00
  (hora de Argentina), revisa los libros de cada usuario con notificaciones activas y envía por Firebase Cloud Messaging
  sólo los avisos nuevos (cada aviso se envía una vez: "por vencer", "vence hoy" y "vencido" son avisos distintos).
  Los tokens de dispositivos que ya no existen se borran solos.
- En **iPhone** las notificaciones requieren abrir la app desde el ícono de la pantalla de inicio (iOS 16.4+).
- Desde **Ajustes → Notificaciones → Enviar notificación de prueba** se prueba el circuito completo desde el servidor.

## Puesta en marcha

### 1. Firebase (una sola vez, en la [consola](https://console.firebase.google.com/) del proyecto `mi-bolsillo-2-22650111-8373c`)

1. **Authentication → Sign-in method:** habilitar *Correo electrónico/contraseña* y *Google*.
2. **Authentication → Settings → Authorized domains:** agregar el dominio donde se publique la app.
3. **Publicar las reglas de seguridad** (importante: las anteriores dejaban que cualquier usuario viera libros ajenos):

   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

### 2. Cloud Functions (avisos push, requiere plan Blaze)

Desde una terminal con `firebase-tools` (en Firebase Studio ya viene instalado):

```bash
cd functions && npm install && cd ..
npx firebase-tools deploy --only functions,firestore:rules,storage --project mi-bolsillo-2-22650111-8373c
```

La primera vez Firebase habilita solo las APIs necesarias (Cloud Functions, Cloud Scheduler, Cloud Build).
Opcional: en *Configuración del proyecto → Cloud Messaging → Certificados push web* se puede generar un par de claves y
definirlo como `NEXT_PUBLIC_FIREBASE_VAPID_KEY`; si no, se usa la clave por defecto de Firebase.

La función diaria también anota los gastos fijos automáticos aunque nadie abra la app.
La primera vez que se publican las reglas de Storage, Firebase pide permiso para que Storage consulte Firestore
(las reglas verifican que seas miembro del libro): aceptarlo.

Pruebas (necesitan Java para los emuladores):

```bash
npm run test:rules       # reglas de Firestore y Storage
npm run test:functions   # lógica de avisos, gastos fijos y resumen semanal
```

### 3. Escanear con IA (opcional)

El botón **Escanear** lee fotos de facturas, tickets, boletas y cheques con Gemini (función `leerComprobante`).
Primero la persona elige qué es (gasto, ingreso, cheque a cobrar o a pagar) y la IA **sólo extrae los datos**
(importe, fechas, emisor, categoría, número y banco); nunca cambia lo elegido, sólo avisa si la foto parece otra cosa.
Se abre el formulario con los datos y la foto adjunta para revisar y guardar.
Sólo responde a usuarios con sesión y tiene un límite de 60 lecturas por persona por día.

1. Crear una clave en [Google AI Studio](https://aistudio.google.com/apikey).
2. Guardarla como secreto y publicar las funciones (Cloud Shell, dentro de la carpeta del proyecto):

   ```bash
   npx firebase-tools functions:secrets:set GEMINI_API_KEY --project mi-bolsillo-2-22650111-8373c
   npx firebase-tools deploy --only functions --project mi-bolsillo-2-22650111-8373c
   ```

Sin la clave la app funciona igual: la categoría se sugiere con reglas y las fotos se adjuntan sin leerse.
Opcional: variable `GEMINI_MODEL` para cambiar el modelo (por defecto `gemini-3.8-flash`).

### 4. Desarrollo

```bash
npm install
npm run dev            # http://localhost:9002 (usa el Firebase real)
```

Para probar sin tocar datos reales, con los emuladores de Firebase (necesita Java).
Con `AI_FAKE=1` en `functions/.env.local` la lectura con IA devuelve datos de ejemplo:

```bash
npx firebase-tools emulators:start --only auth,firestore,storage,functions
NEXT_PUBLIC_USE_EMULATORS=true npm run dev
```

### 5. Producción

```bash
npm run build && npm start
```

O publicar con Firebase App Hosting (configurado en `apphosting.yaml`).

## Estructura

```
src/app/(dashboard)/     pantallas internas (inicio, movimientos, cheques, presupuestos, ajustes)
src/app/login, register  acceso
src/components/providers wallet-provider (datos en tiempo real), notifications, theme
src/components/…         diálogos y piezas de cada módulo
src/lib/                 formato de moneda/fechas, alertas, CSV, categorías por defecto
firestore.rules          reglas de seguridad
public/icons, sw.js      ícono, PWA y notificaciones
```
