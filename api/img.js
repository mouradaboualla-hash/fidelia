// GET /api/img?u=URL → sirve una imagen pública desde nuestro dominio (para leer el color del logo).
import { manejar, descargar, fallo } from "./_lib.js";

export default manejar(async (req, res) => {
  const u = String(req.query.u || "");
  if (!u) throw fallo(400, "Falta la imagen.");
  const { buffer, tipo } = await descargar(u, { max: 2_000_000, tipos: ["image/"], timeout: 6000 });
  res.setHeader("Content-Type", tipo.includes("svg") ? "image/svg+xml" : tipo.split(";")[0]);
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).end(buffer);
});
