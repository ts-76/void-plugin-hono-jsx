import { defineHandler } from 'void';
export const loader = defineHandler(async (c) => { if (c.req.query('value') === 'slow') await new Promise((resolve) => setTimeout(resolve, 500)); return { search: c.req.query('value') ?? '', tags: c.req.queries('tag') ?? [] }; });
const save = defineHandler(async (c) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const body = await c.req.json<{ value?: string }>();
  return c.redirect('/links?value=' + c.req.method + ':' + encodeURIComponent(body.value ?? ''), 303);
});
export const actions = { save, fail: defineHandler((c) => c.json({ message: 'Link action failed' }, 500)) };
