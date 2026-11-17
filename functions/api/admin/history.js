// Dashboard: list earlier saves, and bring one back.
import { json, listHistory, getHistory, saveCatalog } from "../../../lib/store.js";

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ items: [] });
  return json({ items: await listHistory(env) });
}

export async function onRequestPost({ env, request, data }) {
  if (!env.DB) return json({ error: "no-db" }, 503);
  const { id } = await request.json().catch(() => ({}));
  const v = await getHistory(env, Number(id));
  if (!v) return json({ error: "not-found" }, 404);
  const at = await saveCatalog(env, v, data.user.email + " (استرجاع)");
  return json({ ok: true, savedAt: at });
}
