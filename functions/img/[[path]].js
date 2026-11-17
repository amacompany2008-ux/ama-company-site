// Serve photos uploaded from the dashboard.
export async function onRequestGet({ env, params }) {
  const key = (params.path || []).join("/");
  if (!env.IMAGES || !/^u\/[\w-]+\.(jpg|jpeg|png|webp)$/i.test(key)) return new Response("Not found", { status: 404 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("cache-control", "public, max-age=31536000, immutable");
  h.set("etag", obj.httpEtag);
  return new Response(obj.body, { headers: h });
}
