import { defineHandler } from 'void';
import { ValidationError } from 'void/handler';

let uploads = 0;
let reads = 0;
let result: { name: string; tags: string[]; files: Array<{ name: string; type: string; size: number; text: string }>; method: string; contentType: string; intent: string | null } | null = null;
export const loader = defineHandler(() => ({ uploads, reads: ++reads, result }));
export const actions = {
  upload: defineHandler(async c => {
    const data = await c.req.formData();
    const name = data.get('name');
    if (typeof name !== 'string' || !name.trim()) throw new ValidationError({ name: 'Name is required.' });
    const files = await Promise.all(data.getAll('files').filter((value): value is File => typeof value !== 'string').map(async file => ({ name: file.name, type: file.type, size: file.size, text: await file.text() })));
    if (c.req.query('slow')) await new Promise(resolve => setTimeout(resolve, 500));
    result = { name, tags: data.getAll('tags').map(String), files, method: c.req.method, contentType: c.req.header('Content-Type') ?? '', intent: data.get('intent')?.toString() ?? null };
    uploads++;
  }),
  redirect: defineHandler(c => c.redirect('/links', 303)),
};
