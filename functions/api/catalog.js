// Public: what the site shows. Hidden products are left out.
import { json, readCatalog } from "../../lib/store.js";

export async function onRequestGet({ env, request }) {
  try {
    const c = await readCatalog(env, request);
    return json({ cats: c.cats, products: c.products.filter((p) => !p.hidden), settings: c.settings }, 200, {
      "cache-control": "public, max-age=20",
    });
  } catch (e) {
    return json({ error: "unavailable" }, 503);
  }
}
