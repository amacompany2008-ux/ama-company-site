// Product link for WhatsApp: a small page with the product photo, name and price for the preview,
// which then opens the product on the site.
import { readCatalog } from "../../lib/store.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function onRequestGet({ env, request, params }) {
  const origin = new URL(request.url).origin;
  const id = String((params.path || [])[0] || "").replace(/[^\w-]/g, "");
  let c;
  try { c = await readCatalog(env, request); } catch { return Response.redirect(origin + "/", 302); }
  const p = c.products.find((x) => x.id === id && !x.hidden);
  if (!p) return Response.redirect(origin + "/#products", 302);
  const cat = c.cats.find((x) => x.id === p.cat);
  const pr = (p.variants ? p.variants.map((v) => v.price) : [p.price]).filter((x) => typeof x === "number");
  const price = !c.settings.showPrices || !pr.length ? "" : Math.min(...pr) === Math.max(...pr) ? `السعر ${pr[0]} ₪` : `من ${Math.min(...pr)} ₪ إلى ${Math.max(...pr)} ₪`;
  const desc = [price, cat && cat.name, ...p.specs.slice(0, 2)].filter(Boolean).join(" · ");
  const im = (p.colors?.[0]?.imgs?.[0]) || p.imgs[0];
  const abs = origin + (im.startsWith("/") ? im : "/" + im);
  const t = esc(p.name), d = esc(desc);
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} | ama.company.ps</title>
<meta name="description" content="${d}">
<meta property="og:type" content="product"><meta property="og:site_name" content="ama.company.ps">
<meta property="og:title" content="${t}"><meta property="og:description" content="${d}">
<meta property="og:image" content="${esc(abs)}"><meta property="og:url" content="${origin}/p/${id}/">
<meta name="twitter:card" content="summary_large_image">
<style>body{font-family:Tahoma,sans-serif;text-align:center;padding:40px 16px;background:#f3f6f7;color:#31424b}img{max-width:280px;border-radius:12px}a{color:#4c636d}</style>
<script>location.replace("/#p-${id}")</script></head>
<body><img src="${esc(abs)}" alt="${t}"><h1>${t}</h1><p>${d}</p><p><a href="/#p-${id}">افتح المنتج بالموقع</a></p></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" } });
}
