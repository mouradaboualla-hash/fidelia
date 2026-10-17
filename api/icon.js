// GET /a/:slug/icon.svg → icono de la app: el logo de la tienda o su inicial sobre su color.
import { db, manejar, fallo, limpiar } from "./_lib.js";

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export default manejar(async (req, res) => {
  const sql = await db();
  const [t] = await sql`SELECT nombre, color, logo FROM tiendas WHERE slug = ${limpiar(req.query.slug, 60)}`;
  if (!t) throw fallo(404, "No encontrada");
  const color = /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#2b4cff";
  let dentro;
  if (t.logo && t.logo.startsWith("data:image/")) {
    dentro = `<rect x="56" y="56" width="400" height="400" rx="80" fill="#fff"/><image href="${esc(t.logo)}" x="96" y="96" width="320" height="320" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    dentro = `<text x="256" y="330" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="240" font-weight="700" fill="#fff">${esc((t.nombre || "?").charAt(0).toUpperCase())}</text>`;
  }
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${color}"/>${dentro}</svg>`);
});
