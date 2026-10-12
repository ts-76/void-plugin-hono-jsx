import { defineHandler } from 'void';
import { ValidationError } from 'void/handler';
let saved = 'Island original'; let submissions = 0;
export const prerender = false;
export const loader = defineHandler(() => ({ saved, submissions }));
const save = defineHandler(async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name.trim()) throw new ValidationError({ name: 'Island name required.' });
  saved = c.req.method === 'DELETE' ? 'Island original' : body.name; submissions++;
});
export const actions = { save, slow: defineHandler(async (c) => { await new Promise((resolve) => setTimeout(resolve, 700)); return save(c); }), fail: defineHandler((c) => c.json({ message: 'Island failed' }, 500)), redirect: defineHandler((c) => c.redirect('/links', 303)) };
