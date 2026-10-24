import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { normalizePath, type Plugin } from 'vite';
import { resolvePagesDir } from 'void/pages';
import { resolveComponent } from './resolve-component.ts';
import { createMarkdownCompiler, renderChunks } from './markdown-compiler.ts';
import type { HonoMarkdownOptions } from './markdown-features.ts';
import { markdownCopyId, markdownCopyCode } from './markdown-copy.ts';
export type { HonoMarkdownOptions } from './markdown-features.ts';
import type { HonoMarkdownApi } from './markdown-api.ts';
import { markdownRuntimePath } from './runtime-paths.ts';

const clientId = 'virtual:void-hono-markdown-client';
const scriptQuery = '?hono-markdown-script';
const literal = (value: unknown) => `JSON.parse(${JSON.stringify(JSON.stringify(value))})`;

// Project from the stable frontmatter result: published common compilers may not
// expose clientFrontmatter yet, but the Void host still owns its HTML metadata.
function selectPageFrontmatter(frontmatter: Record<string, unknown>, selection: HonoMarkdownOptions['clientFrontmatter'] = true) {
  if (selection === true) return frontmatter;
  if (selection === false) return {};
  if (!Array.isArray(selection) || selection.some(key => typeof key !== 'string')) throw new Error('Hono Markdown: clientFrontmatter must be a boolean or an array of frontmatter keys.');
  return Object.fromEntries(selection.filter(key => Object.hasOwn(frontmatter, key)).map(key => [key, frontmatter[key]]));
}

/** Optional authored Markdown compiler; independent of @void/md private files. */
export function voidHonoMarkdown(options: HonoMarkdownOptions = {}): Plugin {
  const compiler = createMarkdownCompiler(options);
  let root = process.cwd();
  let pagesDir = resolvePagesDir(root);
  let scripts = new Map<string, string>();
  let files = new Map<string, string>();
  let sources = new Map<string, ReturnType<typeof compiler.parse>>();
  function rescan() {
    const nextScripts = new Map<string, string>();
    const nextFiles = new Map<string, string>();
    const nextSources = new Map<string, ReturnType<typeof compiler.parse>>();
    for (const entry of existsSync(pagesDir) ? readdirSync(pagesDir, { recursive: true, withFileTypes: true }) : []) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const file = join(entry.parentPath, entry.name);
      const id = normalizePath(relative(pagesDir, file)).replace(/\.md$/, '').replace(/\.island$/, '').replace(/\/index$/, '').replace(/^index$/, '') || 'index';
      const canonical = realpathSync(file);
      const extracted = nextSources.get(canonical) ?? compiler.parse(readFileSync(canonical, 'utf8'));
      // Older common packages expose hasCode only; preserve their default copy behavior.
      if (!nextSources.has(canonical) && (extracted.needsCodeCopy ?? extracted.hasCode)) extracted.clientCode = `import ${JSON.stringify(markdownCopyId)};\n` + extracted.clientCode;
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
    resolveId(id) { if (id === clientId || id === markdownCopyId) return `\0${id}`; },
    load(id) {
      if (id === `\0${markdownCopyId}`) return markdownCopyCode;
      if (id.endsWith(scriptQuery)) return source(id.slice(0, -scriptQuery.length)).clientCode || 'export {};';
      if (id !== `\0${clientId}`) return;
      if (!files.size) return 'export {};';
      return `const scripts = {${[...files].map(([id, file]) => `${JSON.stringify(id)}: () => import(${JSON.stringify(normalizePath(file) + scriptQuery)})`).join(',')}};
const id = document.getElementById('app')?.getAttribute('data-md-script');
if (id && scripts[id]) await scripts[id]();`;
    },
    transform: {
      filter: { id: /\.md$/ },
      async handler(source, id) {
        const cached = sources.get(realpathSync(id));
        const result = await compiler.render(cached?.source === source ? cached : compiler.parse(source));
        const imports = [...result.imports.map(entry => ({ ...entry, kind: 'island' as const })), ...result.staticImports.map(entry => ({ ...entry, kind: 'static' as const }))].map((entry, index) => {
          const target = resolveComponent(entry.specifier, dirname(id), ['.tsx', '.jsx']);
          if (!target || !entry.specifier.startsWith('.')) throw new Error(`Hono Markdown: cannot resolve relative TSX/JSX component ${entry.specifier} in ${id}.`);
          return { ...entry, alias: `__island${index}`, islandId: normalizePath(relative(root, realpathSync(target))) };
        });
        const chunks = renderChunks(result.html, new Set(imports.map(entry => entry.importName)), new Set(result.staticImports.map(entry => entry.importName)));
        const clientFrontmatter = selectPageFrontmatter(result.frontmatter, options.clientFrontmatter);
        const limitedFrontmatter = clientFrontmatter !== result.frontmatter;
        const wrapsIslands = limitedFrontmatter && result.imports.length > 0;
        const emit = (chunk: (typeof chunks)[number]): string => {
          if ('html' in chunk) return `raw(${JSON.stringify(chunk.html)})`;
          const entry = imports.find(entry => entry.importName === chunk.name)!;
          const props = literal(chunk.props);
          if (entry.kind === 'static') return `jsx(${entry.alias}, { ...${props}${chunk.children ? `, children: [${chunk.children.map(emit).join(',')}]` : ''} })`;
          // Islands render with the browser frontmatter during SSR too, so hydration sees the same values.
          const island = `jsx(${entry.alias}, ${props})`;
          return `jsx('div', { 'data-island': ${JSON.stringify(entry.islandId)}, 'data-hydrate': ${JSON.stringify(entry.hydrate)}, 'data-props': JSON.stringify(${props}), children: ${limitedFrontmatter ? `jsx(__ClientMarkdown, { children: ${island} })` : island} })`;
        };
        const children = chunks.map(emit);
        return { code: `import { jsx, Fragment } from 'hono/jsx/jsx-runtime';
import { raw } from 'hono/html';
${imports.map(entry => `import ${entry.alias} from ${JSON.stringify(entry.specifier)};`).join('\n')}
${wrapsIslands ? `import { useContext } from 'hono/jsx';
import { MarkdownContext as __MarkdownContext } from ${JSON.stringify(markdownRuntimePath)};
` : ''}export const frontmatter = ${literal(result.frontmatter)};
export const clientFrontmatter = ${limitedFrontmatter ? literal(clientFrontmatter) : 'frontmatter'};
export const headings = ${literal(result.headings)};
${wrapsIslands ? `function __ClientMarkdown({ children }) { return jsx(__MarkdownContext.Provider, { value: { ...useContext(__MarkdownContext), frontmatter: clientFrontmatter }, children }); }
` : ''}
export default function MarkdownPage() { return jsx(Fragment, { children: [${children.join(',')}] }); }`, map: null };
      },
    },
  };
}
