import { readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { normalizePath, parseSync, type Plugin } from 'vite';
import { scanPages, resolveEffectiveLayoutChain, resolvePagesDir, type PageScanResult } from 'void/pages';
import { findIslandImports, editIslandSource, computePagesNeedingClientJS, ISLANDS_RENDERER_ID, ISLANDS_CLIENT_ENTRY_ID } from 'void/pages-islands-plugin';

import { resolveComponent } from './resolve-component.ts';

/** Hono mounting through Void's shared island scheduler. */
export function honoIslands(): Plugin {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  const islands = new Map<string, string>();
  const pageFiles = new Set<string>();
  const graph = new Map<string, Set<string>>();
  const directlyInteractive = new Set<string>();
  const interactivePages = new Set<string>();
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
      const path = resolveComponent(entry.specifier, join(filename, '..'), ['.tsx', '.jsx']);
      if (!path || !/\.[jt]sx$/.test(path)) throw new Error(`Hono islands: cannot resolve TSX/JSX component ${entry.specifier} in ${filename}.`);
      const canonical = realpathSync(path);
      const id = normalizePath(relative(root, canonical));
      islands.set(id, canonical);
    }
    return found;
  }

  async function rescan() {
    scan = await scanPages(root, { pagesDir });
    islands.clear(); pageFiles.clear(); graph.clear(); directlyInteractive.clear(); interactivePages.clear();
    const visit = (filename: string) => {
      const canonical = realpathSync(filename);
      if (graph.has(canonical)) return;
      const dependencies = new Set<string>(); graph.set(canonical, dependencies); pageFiles.add(canonical);
      const code = readFileSync(canonical, 'utf8');
      const found = imports(code, canonical);
      if (found.length) {
        if (!/\.[jt]sx$/.test(canonical)) throw new Error('Hono islands: attributed imports require a static TSX/JSX module.');
        directlyInteractive.add(canonical);
      }
      for (const node of parseSync(canonical, code).program.body) {
        const source = node.type === 'ImportDeclaration' ? node.source : node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration' ? node.source : undefined;
        const typeOnly = node.type === 'ImportDeclaration' ? node.importKind === 'type' || (node.specifiers.length > 0 && node.specifiers.every((entry) => entry.type === 'ImportSpecifier' && entry.importKind === 'type')) : (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.exportKind === 'type';
        if (!source || typeOnly || !source.value.startsWith('.') || found.some((entry) => entry.specifier === source.value)) continue;
        const target = resolveComponent(source.value, join(canonical, '..'), ['.tsx', '.jsx', '.ts', '.js']);
        if (!target || !/\.[jt]sx?$/.test(target)) continue;
        dependencies.add(realpathSync(target)); visit(target);
      }

    };
    for (const entry of [...scan.pages.filter((page) => page.island).map((page) => page.componentPath), ...scan.layouts.filter((layout) => layout.island).map((layout) => layout.filePath), ...scan.namedLayouts.filter((layout) => layout.island).map((layout) => layout.filePath)]) visit(join(pagesDir, entry));
    const validateInteractive = (filename: string, seen = new Set<string>()) => {
      const canonical = realpathSync(filename);
      if (seen.has(canonical)) return; seen.add(canonical);
      const code = readFileSync(canonical, 'utf8');
      if (islandImports(code, canonical).length) throw new Error('Hono islands: attributed imports inside an interactive component are unsupported; use ordinary component imports there.');
      for (const node of parseSync(canonical, code).program.body) {
        const source = node.type === 'ImportDeclaration' ? node.source : node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration' ? node.source : undefined;
        const typeOnly = node.type === 'ImportDeclaration' ? node.importKind === 'type' || (node.specifiers.length > 0 && node.specifiers.every((entry) => entry.type === 'ImportSpecifier' && entry.importKind === 'type')) : (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.exportKind === 'type';
        if (!source || typeOnly || !source.value.startsWith('.')) continue;
        const target = resolveComponent(source.value, join(canonical, '..'), ['.tsx', '.jsx', '.ts', '.js']);
        if (target && /\.[jt]sx?$/.test(target)) validateInteractive(target, seen);
      }
    };
    for (const target of islands.values()) validateInteractive(target);
    for (const page of scan.pages.filter((page) => !page.island)) {
      for (const file of [page.componentPath, ...resolveEffectiveLayoutChain(page, scan.layouts, scan.namedLayouts).map((layout) => layout.filePath)]) validateInteractive(join(pagesDir, file));
    }
    const needsJS = new Set(directlyInteractive);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [file, dependencies] of graph) if (!needsJS.has(file) && [...dependencies].some((target) => needsJS.has(target))) { needsJS.add(file); changed = true; }
    }
    for (const page of scan.pages.filter((page) => page.island)) {
      const files = [page.componentPath, ...resolveEffectiveLayoutChain(page, scan.layouts, scan.namedLayouts).map((layout) => layout.filePath)];
      if (files.some((file) => needsJS.has(realpathSync(join(pagesDir, file))))) interactivePages.add(page.componentId);
    }
  }

  return {
    name: 'void-hono:islands',
    enforce: 'pre',
    buildStart: rescan,
    async hotUpdate({ file, modules, timestamp }) {
      const inPages = normalizePath(file).startsWith(normalizePath(pagesDir) + '/');
      if (!inPages && ![...pageFiles, ...islands.values()].some((path) => normalizePath(path) === normalizePath(file))) return;
      await rescan();
      const invalidated = new Set<(typeof modules)[number]>();
      for (const id of [ISLANDS_RENDERER_ID, ISLANDS_CLIENT_ENTRY_ID, 'virtual:void-pages-renderer']) {
        const module = this.environment.moduleGraph.getModuleById(`\0${id}`);
        if (module) this.environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
      }
      if (!inPages && this.environment.config.consumer === 'client') this.environment.hot.send({ type: 'full-reload' });
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
      if ((pageFiles.has(canonical) || [...islands.values()].includes(canonical)) && parseSync(filename, code).program.body.some((node) => node.type === 'ImportDeclaration' && node.importKind !== 'type' && ['void-plugin-hono-jsx/form', 'void-plugin-hono-jsx/pages'].includes(node.source.value) && node.specifiers.some((entry) => entry.type !== 'ImportSpecifier' ? node.source.value.endsWith('/form') : entry.importKind !== 'type' && ['useForm', 'action', 'setActionRouter'].includes('name' in entry.imported ? entry.imported.name : entry.imported.value)))) {
        throw new Error('Hono islands: useForm/action require full Pages; use named useIslandForm/Form imports for islands.');
      }
      const found = islandImports(code, filename);
      if (!found.length) return;
      if (!pageFiles.has(canonical)) throw new Error('Hono islands: attributed imports require a static island page, layout or component graph; use ordinary imports inside interactive components.');
      imports(code, filename);
      // Void requests static modules in the client environment to collect CSS.
      // Actual interactive entry graphs were validated above; strip attributes
      // for that traversal rather than generating server-only marker wrappers.
      if (this.environment?.config.consumer === 'client') return editIslandSource(code, found.map((entry) => ({ start: entry.start, end: entry.end, text: `import ${entry.importName} from ${entry.specifierRaw};` })));
      return editIslandSource(code, found.map((entry) => {
        const path = resolveComponent(entry.specifier, join(filename, '..'), ['.tsx', '.jsx']);
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
        const interactive = [...new Set([...computePagesNeedingClientJS(scan, pagesDir, null), ...interactivePages])];
        return `import { renderPage } from 'virtual:void-pages-renderer';
const interactive = new Set(${JSON.stringify(interactive)});
export function renderIslandPage(page, assets) {
  if (page.deferred?.length || page.deferredKeys) throw new Error('Hono islands: deferred props are unsupported.');
  return renderPage(page, interactive.has(page.component) ? assets : { ...assets, preloads: '', body: '' });
}`;
      }
      if (id === `\0${ISLANDS_CLIENT_ENTRY_ID}`) {
        if (!islands.size || !interactivePages.size) return 'export {};';
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
