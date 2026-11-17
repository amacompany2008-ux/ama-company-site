// Dashboard: read the full catalog (hidden products included) and save a new version.
import { json, readCatalog, clean, saveCatalog } from "../../../lib/store.js";

export async function onRequestGet({ env, request, data }) {
  const c = await readCatalog(env, request);
  return json({ ...c, user: data.user.email, storage: { db: !!env.DB, images: !!env.IMAGES } });
}

export async function onRequestPut({ env, request, data }) {
  if (!env.DB) return json({ error: "no-db", message: "قاعدة البيانات مش مربوطة بالموقع لسا." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad-json" }, 400); }
  const current = await readCatalog(env, request);
  if (body.baseSavedAt !== undefined && current.savedAt && body.baseSavedAt !== current.savedAt)
    return json({ error: "conflict", message: "حدا ثاني حفظ تعديلات من شوي. حدّث الصفحة وارجع عدّل." }, 409);
  const cleaned = clean(body);
  if (!cleaned.products.length) return json({ error: "empty", message: "ما في ولا منتج. ما حفظت عشان ما ينمسح الموقع بالغلط." }, 400);
  const at = await saveCatalog(env, cleaned, data.user.email);
  return json({ ok: true, savedAt: at, counts: { products: cleaned.products.length, cats: cleaned.cats.length } });
}
