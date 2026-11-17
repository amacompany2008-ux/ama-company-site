// Dashboard: store an uploaded photo (already resized in the browser) in R2.
import { json } from "../../../lib/store.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function onRequestPost({ env, request }) {
  if (!env.IMAGES) return json({ error: "no-images", message: "مخزن الصور (R2) مش مربوط بالموقع لسا." }, 503);
  const type = (request.headers.get("content-type") || "").split(";")[0].trim();
  const ext = TYPES[type];
  if (!ext) return json({ error: "type", message: "لازم تكون صورة JPG أو PNG أو WEBP." }, 415);
  const body = await request.arrayBuffer();
  if (body.byteLength > 6 * 1024 * 1024) return json({ error: "size", message: "الصورة كبيرة كثير." }, 413);
  const key = `u/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.IMAGES.put(key, body, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" } });
  return json({ ok: true, url: `/img/${key}` });
}
