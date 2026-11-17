// Every dashboard API call must carry a valid Cloudflare Access login for the company email.
import { json, accessUser } from "../../../lib/store.js";

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN)
    return json({ error: "not-configured", message: "لوحة التحكم لسا مش مفعّلة: ناقص إعداد الدخول (ACCESS_AUD و ACCESS_TEAM_DOMAIN)." }, 503);
  const user = await accessUser(request, env);
  if (!user) return json({ error: "unauthorized", message: "لازم تسجّل دخول من جديد." }, 401);
  ctx.data.user = user;
  return ctx.next();
}
