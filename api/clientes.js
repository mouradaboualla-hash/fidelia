// POST /api/clientes { slug, nombre, tel } → alta del cliente en el club, devuelve su código.
// GET  /api/clientes?slug=xxx&code=ABC123 → tarjeta del cliente (puntos y últimos movimientos).
import { db, manejar, enviar, cuerpo, fallo, limpiar, codigo } from "./_lib.js";

export default manejar(async (req, res) => {
  const sql = await db();
  if (req.method === "GET") {
    const slug = limpiar(req.query.slug, 60), code = limpiar(req.query.code, 10).toUpperCase();
    const [c] = await sql`SELECT c.id, c.code, c.nombre, c.puntos FROM clientes c JOIN tiendas t ON t.id = c.tienda_id
      WHERE t.slug = ${slug} AND c.code = ${code}`;
    if (!c) throw fallo(404, "Tarjeta no encontrada.");
    const movs = await sql`SELECT puntos, detalle, fecha FROM movimientos WHERE cliente_id = ${c.id} ORDER BY fecha DESC LIMIT 10`;
    return enviar(res, 200, { code: c.code, nombre: c.nombre, puntos: c.puntos, movimientos: movs });
  }
  if (req.method !== "POST") return enviar(res, 405, { error: "Método no permitido" });

  const b = cuerpo(req);
  const slug = limpiar(b.slug, 60), nombre = limpiar(b.nombre, 60), tel = limpiar(b.tel, 20);
  if (nombre.length < 2) throw fallo(400, "Escribe tu nombre.");
  const [t] = await sql`SELECT id FROM tiendas WHERE slug = ${slug}`;
  if (!t) throw fallo(404, "No encontramos esta tienda.");
  for (let i = 0; i < 5; i++) {
    const code = codigo(6);
    const filas = await sql`INSERT INTO clientes (tienda_id, code, nombre, tel) VALUES (${t.id}, ${code}, ${nombre}, ${tel})
      ON CONFLICT (tienda_id, code) DO NOTHING RETURNING id`;
    if (filas.length) {
      await sql`INSERT INTO movimientos (cliente_id, puntos, detalle) VALUES (${filas[0].id}, 0, 'Alta en el club')`;
      return enviar(res, 201, { code, nombre, puntos: 0, movimientos: [] });
    }
  }
  throw fallo(500, "No se pudo crear la tarjeta. Inténtalo de nuevo.");
});
