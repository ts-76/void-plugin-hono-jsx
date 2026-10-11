import { defineHandler } from 'void';
export const prerender = true;
export const getPrerenderPaths = () => [{ id: 'alice' }, { id: 'bob' }];
export const loader = defineHandler((c) => ({ label: c.req.param('id') ?? '', initialCount: c.req.param('id') === 'alice' ? 7 : 8, message: 'Declared dynamic path' }));
