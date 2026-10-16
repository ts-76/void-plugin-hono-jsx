import { voidHonoPages, type HonoPagesOptions } from 'void-plugin-hono-jsx/plugin';
const options: HonoPagesOptions = { viewTransitions: true, prefetch: { cacheFor: ['5s', '10s'], hoverDelay: 20 } };
voidHonoPages(options);
// @ts-expect-error Transition setting is boolean.
voidHonoPages({ viewTransitions: 'yes' });
// @ts-expect-error Hover delay uses milliseconds.
voidHonoPages({ prefetch: { hoverDelay: '20ms' } });
