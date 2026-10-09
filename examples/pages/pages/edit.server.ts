import { defineHandler } from 'void';
import { ValidationError } from 'void/handler';

let name = 'Original';
let submissions = 0;
export const loader = defineHandler(() => ({ name, submissions }));
export const action = defineHandler(async (c) => {
  const body: unknown = await c.req.json();
  if (typeof body !== 'object' || body === null || !('name' in body) || typeof body.name !== 'string' || !body.name.trim()) {
    throw new ValidationError({ name: 'Name is required.' });
  }
  submissions++;
  name = c.req.method === 'DELETE' ? 'Original' : body.name.trim();
});
