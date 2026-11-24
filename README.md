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
| **Ajustes** | Perfil, cambiar contraseña, notificaciones (activar, anticipación, prueba), tema claro/oscuro/automático, instalar la app, libros (renombrar, moneda, crear, eliminar) y categorías (crear, editar color/tipo, borrar). |

**Libros:** cada usuario puede tener varios (por ejemplo “Casa” y “Negocio”), cada uno con su moneda.
Al registrarse se crea uno automáticamente con categorías listas para usar.

### Notificaciones

- **Campanita** en la app con todos los avisos: cheques vencidos o por vencer (anticipación configurable) y presupuestos al 80 %/superados.
- **Notificaciones del sistema** (Android, compu; en iPhone sólo con la app agregada a la pantalla de inicio, iOS 16.4+):
  se muestran al abrir la app o mientras está abierta, una sola vez por aviso. Tocar la notificación abre la pantalla correspondiente.
- El *service worker* (`public/sw.js`) ya maneja eventos `push`, así que se puede sumar Firebase Cloud Messaging + una
  Cloud Function programada para recibir avisos **con la app cerrada** (requiere plan Blaze de Firebase).

## Puesta en marcha

### 1. Firebase (una sola vez, en la [consola](https://console.firebase.google.com/) del proyecto `studio-1176439213-c80ed`)

1. **Authentication → Sign-in method:** habilitar *Correo electrónico/contraseña* y *Google*.
2. **Authentication → Settings → Authorized domains:** agregar el dominio donde se publique la app.
3. **Publicar las reglas de seguridad** (importante: las anteriores dejaban que cualquier usuario viera libros ajenos):

   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

### 2. IA (opcional)

La sugerencia de categoría funciona sin IA con reglas por palabras clave. Para la sugerencia con IA y la lectura de
tickets por foto, crear una clave en [Google AI Studio](https://aistudio.google.com/apikey) y definirla como
`GEMINI_API_KEY` (en `.env.local` para desarrollo, o como secreto en `apphosting.yaml` en producción).

### 3. Desarrollo

```bash
npm install
npm run dev            # http://localhost:9002 (usa el Firebase real)
```

Para probar sin tocar datos reales, con los emuladores de Firebase (necesita Java):

```bash
npx firebase-tools emulators:start --only auth,firestore
NEXT_PUBLIC_USE_EMULATORS=true npm run dev
```

### 4. Producción

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
