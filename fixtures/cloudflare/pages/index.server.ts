import { defineHandler, defineHead, type InferProps } from 'void';
import { db, desc } from 'void/db';
import { ValidationError } from 'void/handler';
import { notes } from '../db/schema';
export const loader = defineHandler(async () => ({ notes: await db.select().from(notes).orderBy(desc(notes.id)).limit(20) }));
export const head = defineHead(() => ({ title: 'Cloudflare Hono RC', meta: [{ name: 'rc-page', content: 'home' }] }));
function value(input: unknown): string { if (typeof input !== 'string' || !input.trim() || input.length > 80) throw new ValidationError({ value: 'Use 1 to 80 synthetic characters.' }); return input; }
export const actions = {
  save: defineHandler(async c => { const input = await c.req.json<{ value: string }>(); await db.insert(notes).values({ value: value(input.value), transport: 'json' }); }),
  upload: defineHandler(async c => {
    const data = await c.req.formData(); const file = data.get('file');
    const detail = JSON.stringify({ tags: data.getAll('tags').map(String), file: file && typeof file !== 'string' ? { name: file.name, size: file.size, text: await file.text() } : null });
    await db.insert(notes).values({ value: value(data.get('value')), transport: 'multipart', detail });
  }),
};
export type Props = InferProps<typeof loader>;
