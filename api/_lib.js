// Utilidades compartidas: base de datos, seguridad de URLs, claves y sectores.
import { neon } from "@neondatabase/serverless";
import dns from "node:dns/promises";
import net from "node:net";
import crypto from "node:crypto";

/* ---------- Base de datos ---------- */
const URL_DB = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sql = URL_DB ? neon(URL_DB) : null;

let listo = false;
export async function db() {
  if (!sql) throw Object.assign(new Error("Falta conectar la base de datos (DATABASE_URL) en Vercel."), { status: 500 });
  if (!listo) {
    await sql`CREATE TABLE IF NOT EXISTS tiendas (
      id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, web TEXT, email TEXT,
      tipo TEXT, ubic TEXT, sector TEXT, color TEXT, logo TEXT, unidad TEXT, rewards JSONB NOT NULL DEFAULT '[]',
      cupon TEXT, clave_hash TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'gratis', creada TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY, tienda_id INT NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE, code TEXT NOT NULL,
      nombre TEXT NOT NULL, tel TEXT, puntos INT NOT NULL DEFAULT 0, creado TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tienda_id, code))`;
    await sql`CREATE TABLE IF NOT EXISTS movimientos (
      id SERIAL PRIMARY KEY, cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      puntos INT NOT NULL, detalle TEXT, fecha TIMESTAMPTZ NOT NULL DEFAULT now())`;
    listo = true;
  }
  return sql;
}

/* ---------- Respuestas ---------- */
export function enviar(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
export function manejar(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      console.error(e);
      enviar(res, e.status || 500, { error: e.status ? e.message : "Error del servidor. Inténtalo de nuevo." });
    }
  };
}
export const fallo = (status, message) => Object.assign(new Error(message), { status });
export function cuerpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

/* ---------- Claves y códigos ---------- */
export function codigo(n, abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789") {
  const b = crypto.randomBytes(n);
  return Array.from(b, x => abc[x % abc.length]).join("");
}
export function hashClave(clave) {
  const sal = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(String(clave), sal, 32).toString("hex");
  return `${sal}:${h}`;
}
export function claveOk(clave, guardado) {
  const [sal, h] = String(guardado || "").split(":");
  if (!sal || !h) return false;
  const c = crypto.scryptSync(String(clave || ""), sal, 32);
  const g = Buffer.from(h, "hex");
  return c.length === g.length && crypto.timingSafeEqual(c, g);
}
export function slugify(t) {
  return String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "tienda";
}
export const limpiar = (s, max = 200) => String(s ?? "").trim().slice(0, max);

/* ---------- Descargas seguras (solo webs públicas) ---------- */
function ipPrivada(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x.startsWith("::ffff:")) return ipPrivada(x.slice(7));
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb");
}
async function comprobarUrl(u) {
  const url = new URL(u);
  if (!/^https?:$/.test(url.protocol)) throw fallo(400, "Solo se admiten webs http o https.");
  if (url.port && !["80", "443"].includes(url.port)) throw fallo(400, "Esa dirección no está permitida.");
  const ips = await dns.lookup(url.hostname, { all: true }).catch(() => { throw fallo(400, "No encontramos esa web. Revisa que esté bien escrita."); });
  if (!ips.length || ips.some(i => ipPrivada(i.address))) throw fallo(400, "Esa dirección no está permitida.");
  return url;
}
export async function descargar(u, { max = 1_500_000, tipos = null, timeout = 8000 } = {}) {
  let actual = u;
  for (let i = 0; i < 4; i++) {
    const url = await comprobarUrl(actual);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    let r;
    try {
      r = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FideliaBot/1.0; +https://fidelia.app)",
        "Accept": tipos ? "image/*,*/*;q=0.5" : "text/html,application/xhtml+xml,text/css,*/*;q=0.5",
        "Accept-Language": "es-ES,es;q=0.9" } });
    } catch { clearTimeout(t); throw fallo(400, "La web no respondió a tiempo."); }
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      clearTimeout(t); actual = new URL(r.headers.get("location"), url).href; continue;
    }
    if (!r.ok) { clearTimeout(t); throw fallo(400, `La web respondió con un error (${r.status}).`); }
    const ct = r.headers.get("content-type") || "";
    if (tipos && !tipos.some(x => ct.includes(x))) { clearTimeout(t); throw fallo(400, "El archivo no es una imagen."); }
    const reader = r.body.getReader(); const partes = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) { ctrl.abort(); break; }
      partes.push(value);
    }
    clearTimeout(t);
    return { buffer: Buffer.concat(partes), tipo: ct, url: url.href };
  }
  throw fallo(400, "La web redirige demasiadas veces.");
}

/* ---------- Sectores ---------- */
export const SECTORES = {
  cafeteria: { kw: ["cafe", "café", "coffee", "cafeteria", "cafetería", "brunch", "espresso"] },
  restaurante: { kw: ["restaurante", "pizza", "burger", "hamburgues", "sushi", "tapas", "grill", "kebab", "menú", "menu del dia", "cocina", "bar ", "taberna", "food"] },
  panaderia: { kw: ["panader", "pan ", "forn", "horno", "pasteler", "bakery", "obrador", "bolleria", "bollería"] },
  belleza: { kw: ["peluquer", "barber", "hair", "estética", "estetica", "beauty", "uñas", "unas", "nails", "spa", "manicura"] },
  moda: { kw: ["moda", "ropa", "fashion", "boutique", "zapat", "calzado", "leggings", "vestidos", "camisetas", "complementos", "colección", "coleccion"] },
  deporte: { kw: ["gimnasio", "gym", "fitness", "crossfit", "yoga", "pilates", "entrenamiento", "deporte", "sport"] },
  salud: { kw: ["farmacia", "parafarmacia", "clínica", "clinica", "dental", "óptica", "optica", "fisioterapia", "salud"] },
  servicios: { kw: [] }
};
export function detectarSector(texto) {
  const t = " " + texto.toLowerCase() + " ";
  let mejor = "servicios", max = 0;
  for (const [k, v] of Object.entries(SECTORES)) {
    const n = v.kw.reduce((s, w) => s + (t.split(w).length - 1), 0);
    if (n > max) { max = n; mejor = k; }
  }
  return mejor;
}
