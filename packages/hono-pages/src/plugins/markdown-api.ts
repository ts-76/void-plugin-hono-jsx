import type { Plugin } from 'vite';

export const markdownDiagnostic = 'Hono Pages: Markdown requires voidHonoMarkdown() from void-plugin-hono-jsx/markdown/plugin and its optional parser dependencies. See docs/markdown.md.';
export type HonoMarkdownApi = {
  adapter: 'hono';
  clientEntryId: string;
  refresh(): void;
  getClientScripts(): ReadonlyMap<string, string>;
  getGraphSource(file: string): string;
};
export function markdownApi(plugins: readonly Plugin[]): HonoMarkdownApi | undefined {
  const markdown = plugins.filter(plugin => plugin.name === 'void-md');
  if (markdown.length > 1) throw new Error('Hono Pages: configure only one Markdown compiler.');
  const plugin = markdown[0];
  if (!plugin) return;
  if (plugin.api?.adapter !== 'hono') throw new Error('Hono Pages: use voidHonoMarkdown(), not @void/md/plugin; the official compiler does not emit Hono components.');
  return plugin.api as HonoMarkdownApi;
}
