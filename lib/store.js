// Shared helpers for the site's Pages Functions.
// The whole catalog (sections, products, settings) is kept as one JSON document in D1,
// with every saved version kept in a history table so a mistake can be undone.

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

async function ensureTables(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS doc (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT NOT NULL, at INTEGER NOT NULL, who TEXT)"),
  ]);
}

// The catalog the site was built with: used until the first save from the dashboard.
async function seed(env, request) {
  const url = new URL("/data/seed.json", request.url);
  const r = await env.ASSETS.fetch(url.toString());
  if (!r.ok) throw new Error("seed missing");
  return r.json();
}

export async function readCatalog(env, request) {
  if (env.DB) {
    await ensureTables(env.DB);
    const row = await env.DB.prepare("SELECT v, at FROM doc WHERE k = 'catalog'").first();
    if (row) return { ...JSON.parse(row.v), savedAt: row.at, source: "db" };
  }
  return { ...(await seed(env, request)), savedAt: null, source: env.DB ? "seed" : "seed-no-db" };
}

const str = (v, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : undefined);
const qty = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.min(1e6, Math.floor(v)) : undefined);
const img = (v) => (typeof v === "string" && /^(\/img\/u\/[\w-]+\.(jpg|jpeg|png|webp)|[\w-]+\.(jpg|jpeg|png|webp))$/i.test(v) ? v : null);
const imgs = (a) => (Array.isArray(a) ? a.map(img).filter(Boolean).slice(0, 20) : []);

// Keep only the fields the site understands, so a bad save can't break the page.
export function clean(input) {
  const cats = (Array.isArray(input.cats) ? input.cats : []).slice(0, 40).map((c) => ({
    id: str(c.id, 40).replace(/[^\w-]/g, "") || "cat",
    c: ["accent", "lilac", "amber", "berry"].includes(c.c) ? c.c : "accent",
    img: img(c.img) || "",
    name: str(c.name, 80),
    desc: str(c.desc, 300),
    icon: str(c.icon, 2000),
  }));
  const catIds = new Set(cats.map((c) => c.id));
  const seen = new Set();
  const products = (Array.isArray(input.products) ? input.products : []).slice(0, 1000).map((p) => {
    let id = str(p.id, 60).replace(/[^\w-]/g, "") || "x" + Math.random().toString(36).slice(2, 8);
    while (seen.has(id)) id += "-2";
    seen.add(id);
    const out = {
      id,
      name: str(p.name, 140),
      cat: catIds.has(p.cat) ? p.cat : cats[0]?.id || "",
      specs: (Array.isArray(p.specs) ? p.specs : []).map((s) => str(s, 120)).filter(Boolean).slice(0, 12),
      imgs: imgs(p.imgs),
    };
    if (p.hidden) out.hidden = true;
    const price = num(p.price);
    if (price !== undefined) out.price = price;
    const q = qty(p.qty);
    if (q !== undefined) out.qty = q;
    if (Array.isArray(p.variants) && p.variants.length) {
      out.variants = p.variants.slice(0, 40).map((v) => {
        const o = { label: str(v.label, 80), price: num(v.price) ?? 0 };
        const vq = qty(v.qty);
        if (vq !== undefined) o.qty = vq;
        if (img(v.img)) o.img = v.img;
        if (Array.isArray(v.imgs) && v.imgs.length) o.imgs = imgs(v.imgs);
        return o;
      }).filter((v) => v.label);
      if (!out.variants.length) delete out.variants;
      else delete out.qty; // with sizes, stock is counted per size
    }
    if (Array.isArray(p.colors) && p.colors.length) {
      out.colors = p.colors.slice(0, 20).map((c) => ({ label: str(c.label, 60), imgs: imgs(c.imgs) }))
        .filter((c) => c.label && c.imgs.length);
      if (!out.colors.length) delete out.colors;
    }
    if (!out.imgs.length) {
      const fromColor = out.colors?.[0]?.imgs || out.variants?.find((v) => v.imgs)?.imgs;
      if (fromColor) out.imgs = [fromColor[0]];
    }
    return out;
  }).filter((p) => p.name && p.imgs.length);
  const s = input.settings || {};
  const sale = s.sale || {};
  const settings = {
    showPrices: !!s.showPrices,
    sale: {
      on: !!sale.on,
      pct: Math.min(90, Math.max(1, Math.round(num(sale.pct) ?? 10))),
      start: str(sale.start, 40),
      end: str(sale.end, 40),
      endLabel: str(sale.endLabel, 60),
    },
  };
  return { cats, products, settings };
}

export async function saveCatalog(env, data, who) {
  await ensureTables(env.DB);
  const v = JSON.stringify(data);
  const at = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO doc (k, v, at) VALUES ('catalog', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, at = ?2").bind(v, at),
    env.DB.prepare("INSERT INTO history (v, at, who) VALUES (?1, ?2, ?3)").bind(v, at, who || ""),
  ]);
  await pruneHistory(env.DB);
  return at;
}

// Old versions delete themselves after 15 days (with a size cap as a safety net).
export const KEEP_DAYS = 15;
async function pruneHistory(db) {
  await db.batch([
    db.prepare("DELETE FROM history WHERE at < ?1").bind(Date.now() - KEEP_DAYS * 86400_000),
    db.prepare("DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT 300)"),
  ]);
}

export async function listHistory(env) {
  await ensureTables(env.DB);
  await pruneHistory(env.DB);
  const r = await env.DB.prepare("SELECT id, at, who, length(v) AS size FROM history ORDER BY id DESC LIMIT 300").all();
  return r.results || [];
}

export async function getHistory(env, id) {
  await ensureTables(env.DB);
  const row = await env.DB.prepare("SELECT v FROM history WHERE id = ?1").bind(id).first();
  return row ? JSON.parse(row.v) : null;
}

// ---- Cloudflare Access: check the signed login token on every dashboard request ----
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
let certCache = { at: 0, keys: [] };

export async function accessUser(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) return null;
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64u(h)));
    payload = JSON.parse(new TextDecoder().decode(b64u(p)));
  } catch { return null; }
  const team = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(env.ACCESS_AUD)) return null;
  if (payload.iss && payload.iss !== `https://${team}`) return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (Date.now() - certCache.at > 3600_000) {
    const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
    if (!r.ok) return null;
    certCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = certCache.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const allowed = (env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(String(payload.email || "").toLowerCase())) return null;
  return { email: payload.email || "" };
}

// What customers may see about stock: only whether something is available, never the count.
// No quantity entered = not counted = available.
export function publicProduct(p) {
  const { qty: q, hidden, ...rest } = p;
  if (rest.variants) {
    rest.variants = rest.variants.map(({ qty: vq, ...v }) => (vq === 0 ? { ...v, out: true } : v));
    if (rest.variants.every((v) => v.out)) rest.out = true;
  } else if (q === 0) rest.out = true;
  return rest;
}
