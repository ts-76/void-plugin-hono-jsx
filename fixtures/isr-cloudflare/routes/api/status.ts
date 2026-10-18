import { defineHandler } from 'void';
import { fixture } from '../../server/fixture';
export const GET = defineHandler(c => c.json({ fixture, revision: c.env.ISR_REVISION }));
