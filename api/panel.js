// POST /api/panel { slug, clave, accion, ... } → acciones del panel de la tienda.
// acciones: entrar | resumen | buscar {code} | sumar {code, puntos} | canjear {code, indice}
import { db, manejar, enviar, cuerpo, fallo, limpiar, claveOk } from "./_lib.js";
import { publica } from "./tiendas.js";

export default manejar(async (req, res) => {
  if (req.method !== "POST") return enviar(res, 405, { error: "Usa POST" });
  const sql = await db();
  const b = cuerpo(req);
  const [t] = await sql`SELECT * FROM tiendas WHERE slug = ${limpiar(b.slug, 60)}`;
  if (!t) throw fallo(404, "No encontramos esta tienda.");
  if (!claveOk(b.clave, t.clave_hash)) throw fallo(401, "La clave no es correcta.");

  const buscar = async code => {
    const [c] = await sql`SELECT id, code, nombre, tel, puntos FROM clientes WHERE tienda_id = ${t.id} AND code = ${limpiar(code, 10).toUpperCase()}`;
    if (!c) throw fallo(404, "No hay ningún cliente con ese código.");
    return c;
  };

  switch (b.accion) {
    case "entrar":
      return enviar(res, 200, { tienda: publica(t) });
    case "resumen": {
      const clientes = await sql`SELECT code, nombre, tel, puntos, creado FROM clientes WHERE tienda_id = ${t.id} ORDER BY puntos DESC, creado DESC LIMIT 500`;
      const [s] = await sql`SELECT
          (SELECT count(*) FROM clientes WHERE tienda_id = ${t.id})::int AS clientes,
          (SELECT coalesce(sum(puntos),0) FROM clientes WHERE tienda_id = ${t.id})::int AS puntos,
          (SELECT count(*) FROM movimientos m JOIN clientes c ON c.id = m.cliente_id WHERE c.tienda_id = ${t.id} AND m.puntos < 0)::int AS canjes,
          (SELECT count(*) FROM movimientos m JOIN clientes c ON c.id = m.cliente_id WHERE c.tienda_id = ${t.id} AND m.puntos > 0 AND m.fecha > now() - interval '30 days')::int AS visitas30`;
      return enviar(res, 200, { tienda: publica(t), stats: s, clientes });
    }
    case "buscar":
      return enviar(res, 200, { cliente: await buscar(b.code) });
    case "sumar": {
      const p = parseInt(b.puntos);
      if (!(p > 0 && p <= 10000)) throw fallo(400, "Indica cuántos puntos sumar.");
      const c = await buscar(b.code);
      const [r] = await sql`UPDATE clientes SET puntos = puntos + ${p} WHERE id = ${c.id} RETURNING puntos`;
      await sql`INSERT INTO movimientos (cliente_id, puntos, detalle) VALUES (${c.id}, ${p}, 'Compra')`;
      return enviar(res, 200, { cliente: { ...c, puntos: r.puntos }, mensaje: `+${p} puntos para ${c.nombre}` });
    }
    case "canjear": {
      const rw = (t.rewards || [])[parseInt(b.indice)];
      if (!rw) throw fallo(400, "Esa recompensa no existe.");
      const c = await buscar(b.code);
      const filas = await sql`UPDATE clientes SET puntos = puntos - ${rw.p} WHERE id = ${c.id} AND puntos >= ${rw.p} RETURNING puntos`;
      if (!filas.length) throw fallo(400, `${c.nombre} no tiene puntos suficientes.`);
      await sql`INSERT INTO movimientos (cliente_id, puntos, detalle) VALUES (${c.id}, ${-rw.p}, ${rw.t})`;
      return enviar(res, 200, { cliente: { ...c, puntos: filas[0].puntos }, mensaje: `Canjeado: ${rw.t}` });
    }
    default:
      throw fallo(400, "Acción no válida.");
  }
});
