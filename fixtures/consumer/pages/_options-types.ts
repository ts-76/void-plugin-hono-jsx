import { voidHonoJsx, type HonoJsxOptions } from 'void-plugin-hono-jsx/plugin';
const options: HonoJsxOptions = { viewTransitions: true, prefetch: { cacheFor: ['5s', '10s'], hoverDelay: 20 } };
voidHonoJsx(options);
// @ts-expect-error Transition setting is boolean.
voidHonoJsx({ viewTransitions: 'yes' });
// @ts-expect-error Hover delay uses milliseconds.
voidHonoJsx({ prefetch: { hoverDelay: '20ms' } });
