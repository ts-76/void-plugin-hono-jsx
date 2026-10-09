import { defineHandler } from 'void';
import { state } from '../../server/state';
export const GET = defineHandler((c) => c.json(state));
export const POST = defineHandler(async (c) => {
  const body: unknown = await c.req.json();
  if (typeof body === 'object' && body !== null) {
    if ('version' in body && typeof body.version === 'number') state.version = body.version;
    if ('fail' in body && typeof body.fail === 'boolean') state.fail = body.fail;
  }
  return c.json(state);
});
