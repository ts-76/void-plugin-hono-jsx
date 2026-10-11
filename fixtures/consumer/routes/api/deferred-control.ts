import { defineHandler } from 'void';
import { status, release } from '../../server/deferred-gates';
export const GET = defineHandler((c) => status(c.req.query('token') ?? ''));
export const POST = defineHandler(async (c) => {
  const body: unknown = await c.req.json();
  if (typeof body !== 'object' || body === null || !('token' in body) || typeof body.token !== 'string') return c.json({ error: 'Missing token.' }, 400);
  return c.json({ released: release(body.token, 'fail' in body && body.fail === true) });
});
