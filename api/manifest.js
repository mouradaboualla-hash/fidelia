// GET /a/:slug/manifest.webmanifest → hace que la app de cada tienda se pueda instalar en el móvil.
import { db, manejar, fallo, limpiar } from "./_lib.js";

export default manejar(async (req, res) => {
  const sql = await db();
  const slug = limpiar(req.query.slug, 60);
  const [t] = await sql`SELECT slug, nombre, color FROM tiendas WHERE slug = ${slug}`;
  if (!t) throw fallo(404, "No encontrada");
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).end(JSON.stringify({
    name: `${t.nombre} · Club`, short_name: t.nombre.slice(0, 12), start_url: `/a/${t.slug}`, scope: `/a/${t.slug}`,
    display: "standalone", background_color: "#f6f6f4", theme_color: t.color, lang: "es",
    icons: [{ src: `/a/${t.slug}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
  }));
});
