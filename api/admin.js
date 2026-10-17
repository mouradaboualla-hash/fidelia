// GET /api/admin (cabecera x-admin-key) → todas las tiendas registradas con sus números.
import { db, manejar, enviar, fallo } from "./_lib.js";
import crypto from "node:crypto";

export default manejar(async (req, res) => {
  const clave = String(req.headers["x-admin-key"] || "");
  const real = String(process.env.ADMIN_KEY || "");
  if (!real) throw fallo(500, "Falta configurar ADMIN_KEY en Vercel.");
  const a = Buffer.from(clave), b = Buffer.from(real);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw fallo(401, "Clave de administrador incorrecta.");
  const sql = await db();
  const tiendas = await sql`SELECT t.slug, t.nombre, t.web, t.email, t.tipo, t.ubic, t.sector, t.color, t.plan, t.creada,
      (SELECT count(*) FROM clientes c WHERE c.tienda_id = t.id)::int AS clientes,
      (SELECT count(*) FROM movimientos m JOIN clientes c ON c.id = m.cliente_id WHERE c.tienda_id = t.id AND m.puntos > 0)::int AS compras
    FROM tiendas t ORDER BY t.creada DESC LIMIT 1000`;
  enviar(res, 200, { tiendas });
});
