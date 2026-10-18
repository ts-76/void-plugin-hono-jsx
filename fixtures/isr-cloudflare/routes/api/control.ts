import { defineHandler, defineMiddleware } from 'void';
import { db } from 'void/db';
import { bodyLimit } from 'hono/body-limit';
import { revalidate } from 'void/isr';
import { cases, renders } from '../../db/schema';
import { acceptsControlKey } from '../../server/control-auth';
import { fixture, paths, privacyModes } from '../../server/fixture';

const authorized = defineMiddleware(async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (typeof c.env.ISR_VERIFY_DIGEST !== 'string' || !await acceptsControlKey(c.req.header('Authorization'), c.env.ISR_VERIFY_DIGEST)) return c.json({ error: 'Forbidden' }, 403);
  await next();
});
export const GET = defineHandler(authorized, async c => c.json({ fixture, revision: c.env.ISR_REVISION,
  cases: await db.select().from(cases), renders: await db.select().from(renders).orderBy(renders.id).limit(1000) }));
export const POST = defineHandler(authorized, bodyLimit({ maxSize: 2048 }), async c => {
  if (!c.req.header('content-type')?.startsWith('application/json')) return c.json({ error: 'JSON required' }, 415);
  const raw = await c.req.text();
  if (raw.length > 2048) return c.json({ error: 'Body too large' }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return c.json({ error: 'Object required' }, 400);
  if ('purge' in body && body.purge !== 'all' && !(Array.isArray(body.purge) && body.purge.length > 0 && body.purge.length <= paths.length && body.purge.every(value => typeof value === 'string' && paths.some(path => path === value)))) return c.json({ error: 'Invalid purge' }, 400);
  if (!('path' in body) && !('purge' in body)) return c.json({ error: 'Command required' }, 400);
  if ('path' in body) {
    if (typeof body.path !== 'string' || !paths.some(path => path === body.path)) return c.json({ error: 'Unknown fixture path' }, 400);
    const patch: Partial<typeof cases.$inferInsert> = {};
    if ('version' in body) { if (!Number.isSafeInteger(body.version) || Number(body.version) < 1 || Number(body.version) > 10000) return c.json({ error: 'Invalid version' }, 400); patch.version = Number(body.version); }
    if ('fail' in body) { if (typeof body.fail !== 'boolean') return c.json({ error: 'Invalid fail' }, 400); patch.fail = body.fail; }
    if ('privacy' in body) { if (typeof body.privacy !== 'string' || !privacyModes.some(mode => mode === body.privacy)) return c.json({ error: 'Invalid privacy' }, 400); patch.privacy = body.privacy; }
    if ('delayMs' in body) { if (!Number.isSafeInteger(body.delayMs) || Number(body.delayMs) < 0 || Number(body.delayMs) > 250) return c.json({ error: 'Invalid delay' }, 400); patch.delayMs = Number(body.delayMs); }
    if (!Object.keys(patch).length) return c.json({ error: 'Patch required' }, 400);
    await db.insert(cases).values({ path: body.path, ...patch }).onConflictDoUpdate({ target: cases.path, set: patch });
  }
  if ('purge' in body) {
    if (body.purge === 'all') await revalidate({ all: true });
    else if (Array.isArray(body.purge) && body.purge.length > 0 && body.purge.length <= paths.length && body.purge.every(value => typeof value === 'string' && paths.some(path => path === value))) await revalidate({ paths: body.purge });
    else return c.json({ error: 'Invalid purge' }, 400);
  }
  return c.json({ ok: true, fixture, revision: c.env.ISR_REVISION });
});
