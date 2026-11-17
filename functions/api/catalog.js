// Public: what the site shows. Hidden products are left out; stock counts become «available / sold out».
import { json, readCatalog, publicProduct } from "../../lib/store.js";

export async function onRequestGet({ env, request }) {
  try {
    const c = await readCatalog(env, request);
    return json({ cats: c.cats, products: c.products.filter((p) => !p.hidden).map(publicProduct), settings: c.settings }, 200, {
      "cache-control": "public, max-age=20",
    });
  } catch (e) {
    return json({ error: "unavailable" }, 503);
  }
}
