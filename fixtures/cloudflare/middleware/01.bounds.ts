import { defineMiddleware } from 'void';
import { bodyLimit } from 'hono/body-limit';
const limit = bodyLimit({ maxSize: 4096 });
export default defineMiddleware(async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex, nofollow');
  const origin = c.req.header('Origin');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && origin && origin !== new URL(c.req.url).origin) return c.text('Same origin required', 403);
  return limit(c, next);
});
