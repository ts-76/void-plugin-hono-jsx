import { readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { normalizePath, parseSync, type Plugin } from 'vite';
import { scanPages, resolvePagesDir, type PageScanResult } from 'void/pages';
import { findIslandImports, editIslandSource, resolveSpecifier, computePagesNeedingClientJS, ISLANDS_RENDERER_ID, ISLANDS_CLIENT_ENTRY_ID } from 'void/pages-islands-plugin';

/** Hono mounting through Void's shared island scheduler. */
export function honoIslands(): Plugin {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  const islands = new Map<string, string>();
  const pageFiles = new Set<string>();
  let scan: PageScanResult | undefined;

  function islandImports(code: string, filename: string) {
    const found = findIslandImports(code, filename);
    const attributed = parseSync(filename, code).program.body.filter((node) => node.type === 'ImportDeclaration' && node.attributes?.some(({ key }) => ('name' in key && key.name === 'island') || ('value' in key && key.value === 'island')));
    if (attributed.length !== found.length) throw new Error(`Hono islands: use one default import with exactly one island attribute using load, visible, idle or media:query in ${filename}.`);
    return found;
  }

  function imports(code: string, filename: string) {
    const found = islandImports(code, filename);
    for (const entry of found) {
      if (!['load', 'visible', 'idle'].includes(entry.hydrate)) {
        const query = entry.hydrate.startsWith('media:') ? entry.hydrate.slice(6).trim() : '';
        let balance = 0;
        for (const character of query) { if (character === '(') balance++; if (character === ')') balance--; if (balance < 0) break; }
        if (!query || balance !== 0 || /[{};]/.test(query)) throw new Error(`Hono islands: unsupported policy or invalid media query '${entry.hydrate}' in ${filename}.`);
      }
      if (!entry.specifier.startsWith('.')) throw new Error(`Hono islands: use a relative TSX/JSX component import in ${filename}.`);
      const path = resolveSpecifier(entry.specifier, join(filename, '..'), ['.tsx', '.jsx']);
      if (!path || !/\.[jt]sx$/.test(path)) throw new Error(`Hono islands: cannot resolve TSX/JSX component ${entry.specifier} in ${filename}.`);
      const canonical = realpathSync(path);
      const id = normalizePath(relative(root, canonical));
      islands.set(id, canonical);
    }
    return found;
  }

  async function rescan() {
    scan = await scanPages(root, { pagesDir });
    islands.clear();
    pageFiles.clear();
    for (const page of scan.pages.filter((page) => page.island)) {
      const filename = realpathSync(join(pagesDir, page.componentPath));
      pageFiles.add(filename);
      imports(readFileSync(filename, 'utf8'), filename);
    }
  }

  return {
    name: 'void-hono:islands',
    enforce: 'pre',
    buildStart: rescan,
    async hotUpdate({ file }) {
      if (normalizePath(file).startsWith(normalizePath(pagesDir) + '/')) await rescan();
    },
    config() {
      return { build: { rollupOptions: { input: { 'islands-client': ISLANDS_CLIENT_ENTRY_ID } } } };
    },
    resolveId(id) {
      if (id === ISLANDS_RENDERER_ID || id === ISLANDS_CLIENT_ENTRY_ID) return `\0${id}`;
    },
    transform(code, id) {
      const filename = id.split('?')[0];
      if (!/\.[jt]sx$/.test(filename) || filename.includes('/node_modules/')) return;
      const canonical = realpathSync(filename);
      if ((pageFiles.has(canonical) || [...islands.values()].includes(canonical)) && parseSync(filename, code).program.body.some((node) => node.type === 'ImportDeclaration' && node.source.value === 'void-plugin-hono-jsx/form')) {
        throw new Error('Hono islands: form helpers are unsupported; use a full Pages component.');
      }
      const found = islandImports(code, filename);
      if (!found.length) return;
      if (!pageFiles.has(realpathSync(filename))) throw new Error('Hono islands: attributed imports are supported only directly in .island.tsx/.island.jsx pages.');
      imports(code, filename);
      return editIslandSource(code, found.map((entry) => {
        const path = resolveSpecifier(entry.specifier, join(filename, '..'), ['.tsx', '.jsx']);
        if (!path) throw new Error(`Hono islands: missing component ${entry.specifier}.`);
        const islandId = normalizePath(relative(root, realpathSync(path)));
        const component = `__honoIslandComponent${entry.start}`;
        return { start: entry.start, end: entry.end, text: `import ${component} from ${entry.specifierRaw};
const ${entry.importName} = (props) => __honoIslandJsx('div', { 'data-island': ${JSON.stringify(islandId)}, 'data-hydrate': ${JSON.stringify(entry.hydrate)}, 'data-props': JSON.stringify(props), children: __honoIslandJsx(${component}, props) });` };
      }), { prepend: "import { jsx as __honoIslandJsx } from 'hono/jsx/jsx-runtime';\n" });
    },
    load(id) {
      if (id === `\0${ISLANDS_RENDERER_ID}`) {
        if (!scan) throw new Error('Hono islands: page discovery has not completed.');
        const interactive = [...computePagesNeedingClientJS(scan, pagesDir, null)];
        return `import { renderPage } from 'virtual:void-pages-renderer';
const interactive = new Set(${JSON.stringify(interactive)});
export function renderIslandPage(page, assets) {
  if (page.deferred?.length || page.deferredKeys) throw new Error('Hono islands: deferred props are unsupported.');
  return renderPage(page, interactive.has(page.component) ? assets : { ...assets, preloads: '', body: '' });
}`;
      }
      if (id === `\0${ISLANDS_CLIENT_ENTRY_ID}`) {
        if (!islands.size) return 'export {};';
        const loaders = [...islands].map(([name, path]) => `${JSON.stringify(name)}: () => import(${JSON.stringify(path)})`).join(',\n');
        return `import { initIslands } from 'void/pages-client';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { render } from 'hono/jsx/dom';
for (const element of document.querySelectorAll('[data-hydrate^="media:"]')) {
  const query = element.getAttribute('data-hydrate').slice(6).trim();
  if (matchMedia(query).media === 'not all' && query !== 'not all') throw new Error('Hono islands: invalid or unsupported media query ' + query);
}
initIslands({ ${loaders} }, (element, module, props) => {
  if (typeof module.default !== 'function') throw new Error('Hono islands: a component must export a default function.');
  render(jsx(module.default, props), element);
  element.setAttribute('data-hono-island', 'mounted');
});`;
      }
    },
  };
}
