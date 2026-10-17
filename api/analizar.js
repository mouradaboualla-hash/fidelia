// POST /api/analizar { web } → nombre, descripción, logo, colores y sector leídos de la web de la tienda.
import { manejar, enviar, cuerpo, descargar, detectarSector, fallo } from "./_lib.js";

const meta = (html, re) => { const m = html.match(re); return m ? decode(m[1].trim()) : ""; };
function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&nbsp;/g, " ");
}
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : "";
}
function metaProp(html, prop) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const p = (attr(tag, "property") || attr(tag, "name") || attr(tag, "itemprop")).toLowerCase();
    if (p === prop) return attr(tag, "content");
  }
  return "";
}
function absoluta(u, base) { try { return new URL(u, base).href; } catch { return ""; } }

function hexNorm(h) {
  h = h.toLowerCase();
  if (h.length === 4) h = "#" + h.slice(1).split("").map(c => c + c).join("");
  return h.length === 7 ? h : null;
}
function esNeutro(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx - mn < 30 || mx < 30 || mn > 225;
}
function coloresDe(texto) {
  const cuenta = {};
  for (const m of texto.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const h = hexNorm(m[0]); if (!h || esNeutro(h)) continue;
    cuenta[h] = (cuenta[h] || 0) + 1;
  }
  for (const m of texto.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi)) {
    const h = "#" + [m[1], m[2], m[3]].map(v => Math.min(255, +v).toString(16).padStart(2, "0")).join("");
    if (esNeutro(h)) continue;
    cuenta[h] = (cuenta[h] || 0) + 1;
  }
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

export default manejar(async (req, res) => {
  if (req.method !== "POST") return enviar(res, 405, { error: "Usa POST" });
  let web = String(cuerpo(req).web || "").trim();
  if (!web) throw fallo(400, "Escribe la web de tu negocio.");
  if (!/^https?:\/\//i.test(web)) web = "https://" + web;
  let dominio;
  try { dominio = new URL(web).hostname.replace(/^www\./, ""); } catch { throw fallo(400, "La web no es válida. Ejemplo: mitienda.es"); }

  let pagina;
  try { pagina = await descargar(web); }
  catch (e) {
    if (web.startsWith("https://")) { try { pagina = await descargar(web.replace("https://", "http://")); } catch { throw e; } }
    else throw e;
  }
  const html = pagina.buffer.toString("utf8");
  const base = pagina.url;

  // Nombre
  const siteName = metaProp(html, "og:site_name");
  const titulo = meta(html, /<title[^>]*>([^<]*)<\/title>/i);
  const nombreDominio = dominio.split(".")[0].split("-").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ");
  let nombre = siteName || titulo.split(/\s[|–—\-:·]\s/)[0] || nombreDominio;
  if (nombre.length > 40) nombre = nombreDominio;

  const descripcion = metaProp(html, "description") || metaProp(html, "og:description");
  const keywords = metaProp(html, "keywords");

  // Logo: icono grande > imagen con "logo" > og:image > favicon
  const iconos = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = attr(tag, "rel").toLowerCase();
    if (!rel.includes("icon")) continue;
    const href = absoluta(attr(tag, "href"), base); if (!href) continue;
    const size = parseInt((attr(tag, "sizes") || "0").split("x")[0]) || (rel.includes("apple") ? 180 : 32);
    iconos.push({ href, size: href.endsWith(".svg") ? 512 : size });
  }
  iconos.sort((a, b) => b.size - a.size);
  let logoImg = "";
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const s = (attr(tag, "src") || attr(tag, "data-src")).trim();
    const pista = (s + " " + attr(tag, "alt") + " " + attr(tag, "class") + " " + attr(tag, "id")).toLowerCase();
    if (s && pista.includes("logo") && !s.startsWith("data:")) { logoImg = absoluta(s.split(" ")[0], base); break; }
  }
  const og = absoluta(metaProp(html, "og:image"), base);
  const logo = (iconos[0] && iconos[0].size >= 120 ? iconos[0].href : "") || logoImg || iconos[0]?.href || og || absoluta("/favicon.ico", base);

  // Colores: theme-color, estilos de la página y su primera hoja de estilos
  const theme = hexNorm(metaProp(html, "theme-color") || "") || null;
  let css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join("\n") + "\n" + (html.match(/style="[^"]*"/gi) || []).join("\n");
  const hojas = (html.match(/<link\b[^>]*>/gi) || []).filter(t => /stylesheet/i.test(attr(t, "rel"))).map(t => absoluta(attr(t, "href"), base)).filter(Boolean).slice(0, 2);
  for (const h of hojas) { try { css += "\n" + (await descargar(h, { max: 800_000, timeout: 5000 })).buffer.toString("utf8"); } catch {} }
  const colores = [...new Set([theme, ...coloresDe(css)].filter(c => c && !esNeutro(c)))].slice(0, 6);

  const sector = detectarSector([dominio, nombre, titulo, descripcion, keywords].join(" "));
  enviar(res, 200, { dominio, nombre, descripcion: descripcion.slice(0, 200), logo, colores, sector });
});
