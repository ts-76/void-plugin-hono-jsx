import { defineHandler } from 'void';
import { action, loader } from './edit.server';
export { loader };
export const actions = {
  default: action,
  save: action,
  redirect: defineHandler((c) => c.redirect('/users/saved')),
  fail: defineHandler((c) => c.json({ message: 'Example action failed.' }, 500)),
  slow: defineHandler(async (c) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return action(c);
  }),
};
