import { defineHandler } from 'void';
import { ValidationError } from 'void/handler';
let saved = 'Original';
let submissions = 0;
export const loader = defineHandler(() => ({ saved, submissions }));
const save = defineHandler(async (c) => {
  const body = await c.req.json<{ name: string; note?: string }>();
  const errors: Record<string, string> = {};
  if (!body.name.trim()) errors.name = 'Name is required.';
  if (body.note !== undefined && !body.note.trim()) errors.note = 'Note is required.';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  submissions++;
  saved = c.req.method === 'DELETE' ? 'Original' : body.name;
});
export const actions = {
  save,
  slow: defineHandler(async (c) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return save(c);
  }),
  fail: defineHandler((c) => c.json({ message: 'Form failed' }, 500)),
  redirect: defineHandler((c) => c.redirect('/links', 303)),
};
