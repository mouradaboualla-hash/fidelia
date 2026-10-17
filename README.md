# Fidelia

Plataforma para que cualquier tienda cree su propia app de fidelización: escribe su web, el sistema lee su logo, colores y sector, ajusta recompensas y obtiene una app instalable para sus clientes y un panel para sumar puntos.

## Qué incluye

| Dirección | Qué es |
|---|---|
| `/` | Creador en 3 pasos (web → análisis → editor con móvil en directo → app creada) |
| `/a/nombre-tienda` | App del cliente: alta, tarjeta con QR, puntos, recompensas, cupón. Instalable en el móvil |
| `/panel/nombre-tienda` | Panel de la tienda con clave de 6 cifras: escanear QR con la cámara, sumar puntos, canjear |
| `/admin` | Todas las tiendas registradas (con ADMIN_KEY) |

API (Vercel Functions, carpeta `api/`): `analizar`, `img`, `tiendas`, `clientes`, `panel`, `admin`, `manifest`, `icon`.
Base de datos: Postgres (Neon). Las tablas se crean solas en la primera llamada.

## Puesta en marcha en Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En vercel.com → **Add New → Project** → elige el repositorio → **Deploy** (sin cambiar nada).
3. En el proyecto → **Storage → Create Database → Neon (Postgres)** → conéctala al proyecto. Esto añade `DATABASE_URL` automáticamente.
4. En **Settings → Environment Variables** añade `ADMIN_KEY` con una clave larga que solo sepas tú.
5. **Deployments → Redeploy** para que coja las variables.
6. Dominio propio (opcional): **Settings → Domains** → añade, por ejemplo, `fidelia.es` y sigue los pasos DNS.

## Prueba completa (5 minutos)

1. Abre la web, pon la web de un negocio real y crea la app. Apunta la clave.
2. Abre el enlace `/a/...` en tu móvil y crea una tarjeta de cliente.
3. Abre `/panel/...` en otro móvil, entra con la clave, escanea el QR del cliente y suma puntos.
4. En la app del cliente los puntos se actualizan solos en unos segundos.
5. Entra en `/admin` con tu ADMIN_KEY y verás la tienda.

## Cambiar el nombre de la marca

Busca y reemplaza `Fidelia` / `fidelia` en `public/*.html` y `api/_lib.js`.

## Siguientes fases

- Cobro de suscripción (Stripe).
- Envío de la clave del panel por correo (Resend).
- Notificaciones push y publicación en App Store / Google Play.
