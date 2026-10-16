import { defineHandler } from 'void';
export const loader = defineHandler((c) => ({ search: c.req.query('value') ?? '', tags: c.req.queries('tag') ?? [] }));
const save = defineHandler(async (c) => {
  const body = await c.req.json<{ value?: string }>();
  return c.redirect('/links?value=' + c.req.method + ':' + encodeURIComponent(body.value ?? ''), 303);
});
export const actions = { save, fail: defineHandler((c) => c.json({ message: 'Link action failed' }, 500)) };
