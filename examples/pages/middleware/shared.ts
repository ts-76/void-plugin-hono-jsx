import { defineMiddleware } from 'void';
export default defineMiddleware(async (c, next) => {
  c.set('shared', { tenant: 'demo', path: c.req.path });
  await next();
});
