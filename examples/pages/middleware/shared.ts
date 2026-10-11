import { defineMiddleware } from 'void';
export default defineMiddleware(async (c, next) => {
  c.set('headDefaults', { title: 'Middleware default', meta: [{ name: 'description', content: 'Middleware description' }, { name: 'middleware-only', content: 'Middleware value' }], htmlAttrs: { 'data-level': 'middleware' }, bodyAttrs: { 'data-level': 'middleware' } });
  c.set('shared', { tenant: 'demo', path: c.req.path });
  await next();
});
