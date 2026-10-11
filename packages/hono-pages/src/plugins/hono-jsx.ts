import { transformWithOxc, type Plugin } from 'vite';

/** JSX factories differ by Vite environment; hooks can be shared via hono/jsx. */
export function honoJsx(): Plugin {
  return {
    name: 'poc:hono-jsx',
    enforce: 'pre',
    async transform(code, id) {
      const filename = id.split('?')[0];
      if (!/\.[jt]sx$/.test(filename) || filename.includes('/node_modules/')) return;
      return transformWithOxc(code, filename, {
        jsx: {
          runtime: 'automatic',
          importSource: this.environment.config.consumer === 'client' ? 'hono/jsx/dom' : 'hono/jsx',
          development: this.environment.mode === 'dev',
        },
      });
    },
  };
}
