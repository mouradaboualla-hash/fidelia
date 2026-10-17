// POST /api/tiendas → crea una tienda y devuelve su enlace y clave del panel.
// GET  /api/tiendas?slug=xxx → datos públicos de la app de esa tienda.
import { db, manejar, enviar, cuerpo, fallo, limpiar, slugify, hashClave, codigo } from "./_lib.js";

const COLOR = /^#[0-9a-f]{6}$/i;
export function publica(t) {
  return { slug: t.slug, nombre: t.nombre, web: t.web, sector: t.sector, color: t.color, logo: t.logo,
    unidad: t.unidad, rewards: t.rewards, cupon: t.cupon, plan: t.plan };
}

export default manejar(async (req, res) => {
  const sql = await db();

  if (req.method === "GET") {
    const slug = limpiar(req.query.slug, 60);
    const [t] = await sql`SELECT * FROM tiendas WHERE slug = ${slug}`;
    if (!t) throw fallo(404, "No encontramos esta tienda.");
    return enviar(res, 200, publica(t));
  }
  if (req.method !== "POST") return enviar(res, 405, { error: "Método no permitido" });

  const b = cuerpo(req);
  const nombre = limpiar(b.nombre, 60);
  const email = limpiar(b.email, 120);
  if (nombre.length < 2) throw fallo(400, "Ponle nombre a tu negocio.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fallo(400, "Revisa el correo electrónico.");
  const color = COLOR.test(b.color) ? b.color : "#2b4cff";
  const rewards = (Array.isArray(b.rewards) ? b.rewards : [])
    .map(r => ({ t: limpiar(r.t, 60), p: Math.max(1, Math.min(100000, parseInt(r.p) || 0)) }))
    .filter(r => r.t).slice(0, 12);
  if (!rewards.length) throw fallo(400, "Añade al menos una recompensa.");

  let logo = String(b.logo || "");
  if (logo.startsWith("data:image/")) { if (logo.length > 300_000) throw fallo(400, "El logo es demasiado grande."); }
  else if (!/^https:\/\//.test(logo)) logo = "";
  logo = logo.slice(0, 300_000);

  // Enlace único
  const base = slugify(nombre);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const [ex] = await sql`SELECT 1 FROM tiendas WHERE slug = ${slug}`;
    if (!ex) break;
    slug = `${base}-${i}`;
  }
  const clave = codigo(6, "0123456789");
  await sql`INSERT INTO tiendas (slug, nombre, web, email, tipo, ubic, sector, color, logo, unidad, rewards, cupon, clave_hash)
    VALUES (${slug}, ${nombre}, ${limpiar(b.web, 120)}, ${email}, ${limpiar(b.tipo, 30)}, ${limpiar(b.ubic, 20)},
      ${limpiar(b.sector, 30)}, ${color}, ${logo}, ${limpiar(b.unidad, 60)}, ${JSON.stringify(rewards)}::jsonb,
      ${limpiar(b.cupon, 80)}, ${hashClave(clave)})`;
  enviar(res, 201, { slug, clave });
});
