import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { normalizePath, type Plugin } from 'vite';
import { resolvePagesDir } from 'void/pages';
import { resolveComponent } from './resolve-component.ts';
import { compileMarkdown, extractMarkdown, renderChunks } from './markdown-compiler.ts';
import type { HonoMarkdownApi } from './markdown-api.ts';

const clientId = 'virtual:void-hono-markdown-client';
const scriptQuery = '?hono-markdown-script';
const literal = (value: unknown) => `JSON.parse(${JSON.stringify(JSON.stringify(value))})`;

/** Optional authored Markdown compiler; independent of @void/md private files. */
export function voidHonoMarkdown(): Plugin {
  let root = process.cwd();
  let pagesDir = resolvePagesDir(root);
  let scripts = new Map<string, string>();
  let files = new Map<string, string>();
  let sources = new Map<string, ReturnType<typeof extractMarkdown>>();
  function rescan() {
    const nextScripts = new Map<string, string>();
    const nextFiles = new Map<string, string>();
    const nextSources = new Map<string, ReturnType<typeof extractMarkdown>>();
    for (const entry of existsSync(pagesDir) ? readdirSync(pagesDir, { recursive: true, withFileTypes: true }) : []) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const file = join(entry.parentPath, entry.name);
      const id = normalizePath(relative(pagesDir, file)).replace(/\.md$/, '').replace(/\.island$/, '').replace(/\/index$/, '').replace(/^index$/, '') || 'index';
      const canonical = realpathSync(file);
      const extracted = nextSources.get(canonical) ?? extractMarkdown(readFileSync(canonical, 'utf8'));
      nextSources.set(canonical, extracted);
      if (extracted.clientCode) { nextScripts.set(id, extracted.clientCode); nextFiles.set(id, file); }
    }
    // Commit complete generations only; a parse error must not publish partial data.
    scripts = nextScripts; files = nextFiles; sources = nextSources;
  }
  function source(file: string) {
    const extracted = sources.get(realpathSync(file));
    if (!extracted) throw new Error(`Hono Markdown: file is absent from the current page scan: ${file}`);
    return extracted;
  }
  const api: HonoMarkdownApi = { adapter: 'hono', clientEntryId: clientId, refresh: rescan, getClientScripts() { return scripts; }, getGraphSource(file) { return source(file).graphSource; } };
  return {
    // Void's Markdown entry/asset convention is shared with @void/md.
    name: 'void-md', enforce: 'pre', api,
    config() { return { build: { rollupOptions: { input: { 'markdown-client': clientId } } } }; },
    configResolved(config) { if (!config.plugins.some(plugin => plugin.name === 'void-hono:pages')) throw new Error('Hono Markdown: configure voidHonoJsx() before voidHonoMarkdown().'); root = realpathSync(config.root); pagesDir = resolvePagesDir(root); rescan(); },
    buildStart() { rescan(); },
    hotUpdate({ file, timestamp }) {
      if (!file.endsWith('.md') || !normalizePath(file).startsWith(normalizePath(pagesDir) + '/')) return;
      rescan();
      const entry = this.environment.moduleGraph.getModuleById(`\0${clientId}`);
      if (entry) this.environment.moduleGraph.invalidateModule(entry, new Set(), timestamp, true);
    },
    resolveId(id) { if (id === clientId) return `\0${id}`; },
    load(id) {
      if (id.endsWith(scriptQuery)) return source(id.slice(0, -scriptQuery.length)).clientCode || 'export {};';
      if (id !== `\0${clientId}`) return;
      if (!files.size) return 'export {};';
      return `const scripts = {${[...files].map(([id, file]) => `${JSON.stringify(id)}: () => import(${JSON.stringify(normalizePath(file) + scriptQuery)})`).join(',')}};
const id = document.getElementById('app')?.getAttribute('data-md-script');
if (id && scripts[id]) await scripts[id]();`;
    },
    transform: {
      filter: { id: /\.md$/ },
      handler(source, id) {
        const result = compileMarkdown(source);
        const imports = result.imports.map((entry, index) => {
          const target = resolveComponent(entry.specifier, dirname(id), ['.tsx', '.jsx']);
          if (!target || !entry.specifier.startsWith('.')) throw new Error(`Hono Markdown: cannot resolve relative TSX/JSX island ${entry.specifier} in ${id}.`);
          return { ...entry, alias: `__island${index}`, islandId: normalizePath(relative(root, realpathSync(target))) };
        });
        const chunks = renderChunks(result.html, new Set(imports.map(entry => entry.importName)));
        const children = chunks.map(chunk => {
          if ('html' in chunk) return `raw(${JSON.stringify(chunk.html)})`;
          const entry = imports.find(entry => entry.importName === chunk.name)!;
          const props = literal(chunk.props);
          return `jsx('div', { 'data-island': ${JSON.stringify(entry.islandId)}, 'data-hydrate': ${JSON.stringify(entry.hydrate)}, 'data-props': JSON.stringify(${props}), children: jsx(${entry.alias}, ${props}) })`;
        });
        return { code: `import { jsx, Fragment } from 'hono/jsx/jsx-runtime';
import { raw } from 'hono/html';
${imports.map(entry => `import ${entry.alias} from ${JSON.stringify(entry.specifier)};`).join('\n')}
export const frontmatter = ${literal(result.frontmatter)};
export const headings = ${literal(result.headings)};
export default function MarkdownPage() { return jsx(Fragment, { children: [${children.join(',')}] }); }`, map: null };
      },
    },
  };
}
