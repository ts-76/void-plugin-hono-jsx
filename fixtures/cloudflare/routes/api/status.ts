import { defineHandler } from 'void';
import { db } from 'void/db';
import { notes } from '../../db/schema';
export const GET = defineHandler(async c => c.json({ fixture: 'void-hono-rc-cloudflare-check', framework: 'Hono JSX', revision: c.env.RC_REVISION, notes: await db.select().from(notes).limit(20) }));
