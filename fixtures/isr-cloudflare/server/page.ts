import { defineHandler } from 'void';
import { db, eq } from 'void/db';
import { cases, renders } from '../db/schema';
import { fixture, paths } from './fixture';

export const loader = defineHandler(async (c) => {
  const path = c.req.path;
  const revision = c.env.ISR_REVISION;
  if (typeof revision !== 'string') throw new Error('Missing fixture revision');
  if (!paths.some(value => value === path)) return c.notFound();
  const [_, rows] = await db.batch([
    db.insert(cases).values({ path }).onConflictDoNothing(),
    db.select().from(cases).where(eq(cases.path, path)),
  ]);
  const state = rows[0];
  const cookie = c.req.header('Cookie')?.match(/(?:^|; )isr-user=(alice|bob)(?:;|$)/)?.[1];
  const bearer = c.req.header('Authorization')?.match(/^Bearer synthetic-(alice|bob)$/)?.[1];
  const access = c.req.header('Cf-Access-Jwt-Assertion')?.match(/^synthetic-(alice|bob)$/)?.[1];
  const viewer = cookie ?? bearer ?? access ?? 'anonymous';
  const [render] = await db.insert(renders).values({ path, version: state.version, viewer, revision, failed: state.fail }).returning({ id: renders.id });
  console.log(JSON.stringify({ fixture, path, renderId: render.id, version: state.version, failed: state.fail, revision }));
  if (state.delayMs) await new Promise(resolve => setTimeout(resolve, state.delayMs));
  if (state.fail) throw new Error('Controlled synthetic ISR regeneration failure');
  if (['private', 'no-store', 'no-cache'].includes(state.privacy)) c.header('Cache-Control', state.privacy);
  if (state.privacy === 'set-cookie') c.header('Set-Cookie', 'isr-synthetic=only-this-response; Secure; HttpOnly; SameSite=Strict');
  if (state.privacy === 'vary-language') c.header('Vary', 'Accept-Language');
  if (state.privacy === 'vary-star') c.header('Vary', '*');
  if (path === '/header-zero') c.header('x-revalidate', '0');
  if (path === '/header-ttl') c.header('x-revalidate', '4');
  return { fixture, path, version: state.version, renderId: render.id, viewer, revision,
    kind: c.req.query('kind') ?? '', unlisted: c.req.query('unlisted') ?? '',
    message: '</script><script>window.isrInjected=1</script>&' };
});
