import { readFileSync, realpathSync } from 'node:fs';
import { join, relative, resolve, dirname, basename } from 'node:path';
import { normalizePath, parseSync, type Plugin } from 'vite';
import { scanPages, resolveEffectiveLayoutChain, resolvePagesDir, type PageScanResult } from 'void/pages';
import { findIslandImports, findStaticCssImports, rewriteCssImportForVirtualModule, editIslandSource, computePagesNeedingClientJS, ISLANDS_RENDERER_ID, ISLANDS_CLIENT_ENTRY_ID } from 'void/pages-islands-plugin';

import { resolveComponent } from './resolve-component.ts';

import { markdownApi, markdownDiagnostic, type HonoMarkdownApi } from './markdown-api.ts';

/** Hono mounting through Void's shared island scheduler. */
export function honoIslands(): Plugin {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  const islands = new Map<string, string>();
  const pageFiles = new Set<string>();
  let dependencyFiles = new Set<string>();
  let cssImports: string[] = [];
  const graph = new Map<string, Set<string>>();
  const directlyInteractive = new Set<string>();
  const interactivePages = new Set<string>();
  const scriptOnlyPages = new Set<string>();
  let scan: PageScanResult | undefined;
  let markdown: HonoMarkdownApi | undefined;

  function islandImports(code: string, filename: string, body = parseSync(filename, code).program.body) {
    const found = findIslandImports(code, filename);
    const attributed = body.filter((node) => node.type === 'ImportDeclaration' && node.attributes?.some(({ key }) => ('name' in key && key.name === 'island') || ('value' in key && key.value === 'island')));
    if (attributed.length !== found.length) throw new Error(`Hono islands: use one default import with exactly one island attribute using load, visible, idle or media:query in ${filename}.`);
    return found;
  }

  function imports(code: string, filename: string, found = islandImports(code, filename)) {
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

  // Refresh before graph analysis, regardless of Markdown hot-hook order.
  async function rescan() {
    markdown?.refresh();
    scan = await scanPages(root, { pagesDir });
    // Never pass Markdown text to the JavaScript static-graph parser.
    for (const file of [...scan.pages.map(page => page.componentPath), ...scan.layouts.map(layout => layout.filePath), ...scan.namedLayouts.map(layout => layout.filePath)]) {
      if (/\.md$/.test(file) && !markdown) throw new Error(`${markdownDiagnostic} ${file}`);
    }
    islands.clear(); pageFiles.clear(); graph.clear(); directlyInteractive.clear(); interactivePages.clear(); scriptOnlyPages.clear();
    // Source and syntax results live for one analysis only, never across edits.
    type Analysis = { code: string; found: ReturnType<typeof findIslandImports>; edges: Array<{ specifier: string; target: string }> };
    const analyses = new Map<string, Analysis>();
    const watched = new Set<string>();
    const watchedBases = new Set<string>();
    const watch = (file: string) => { const path = normalizePath(file); watched.add(path); dependencyFiles.add(path); };
    const watchImport = (specifier: string, filename: string) => {
      const base = resolve(dirname(filename), specifier);
      if (watchedBases.has(base)) return; watchedBases.add(base);
      const bases = new Set([base]);
      // Keep missing targets observable through symlinked directories too.
      try { bases.add(join(realpathSync(dirname(base)), basename(base))); } catch {}
      try { bases.add(realpathSync(base)); } catch {}
      for (const candidate of bases) {
        watch(candidate);
        for (const extension of ['.tsx', '.jsx', '.ts', '.js']) { watch(candidate + extension); watch(join(candidate, 'index' + extension)); }
      }
    };
    const analyze = (canonical: string): Analysis => {
      const previous = analyses.get(canonical);
      if (previous) return previous;
      // Retain failed dependencies until recovery so an edit can trigger a rescan.
      watch(canonical);
      const code = canonical.endsWith('.md') && markdown ? markdown.getGraphSource(canonical) : readFileSync(canonical, 'utf8');
      const parsed = parseSync(canonical, code);
      if (parsed.errors.length) throw new Error(`Hono islands: cannot parse ${canonical}: ${parsed.errors.map(error => error.message).join('; ')}`);
      const body = parsed.program.body;
      const found = islandImports(code, canonical, body);
      const edges: Analysis['edges'] = [];
      for (const node of body) {
        const source = node.type === 'ImportDeclaration' ? node.source : node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration' ? node.source : undefined;
        const typeOnly = node.type === 'ImportDeclaration' ? node.importKind === 'type' || (node.specifiers.length > 0 && node.specifiers.every((entry) => entry.type === 'ImportSpecifier' && entry.importKind === 'type')) : (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.exportKind === 'type';
        if (!source || typeOnly || !source.value.startsWith('.')) continue;
        const target = resolveComponent(source.value, join(canonical, '..'), ['.tsx', '.jsx', '.ts', '.js']);
        if (!target || /\.[jt]sx?$/.test(target)) watchImport(source.value, canonical);
        if (target && /\.[jt]sx?$/.test(target)) edges.push({ specifier: source.value, target: realpathSync(target) });
      }
      const analysis = { code, found, edges }; analyses.set(canonical, analysis); return analysis;
    };
    const visit = (filename: string) => {
      const canonical = realpathSync(filename);
      if (graph.has(canonical)) return;
      const dependencies = new Set<string>(); graph.set(canonical, dependencies); pageFiles.add(canonical);
      const { code, found, edges } = analyze(canonical);
      imports(code, canonical, found);
      if (found.length) {
        if (!/\.[jt]sx$/.test(canonical) && !(canonical.endsWith('.md') && markdown)) throw new Error('Hono islands: attributed imports require a static TSX/JSX module.');
        directlyInteractive.add(canonical);
      }
      for (const edge of edges) {
        if (found.some(entry => entry.specifier === edge.specifier)) continue;
        dependencies.add(edge.target); visit(edge.target);
      }
    };
    for (const entry of [...scan.pages.filter((page) => page.island).map((page) => page.componentPath), ...scan.layouts.filter((layout) => layout.island).map((layout) => layout.filePath), ...scan.namedLayouts.filter((layout) => layout.island).map((layout) => layout.filePath)]) visit(join(pagesDir, entry));
    const validated = new Set<string>();
    const validateInteractive = (filename: string) => {
      const canonical = realpathSync(filename);
      if (validated.has(canonical)) return; validated.add(canonical);
      const { found, edges } = analyze(canonical);
      if (found.length) throw new Error('Hono islands: attributed imports inside an interactive component are unsupported; use ordinary component imports there.');
      for (const edge of edges) validateInteractive(edge.target);
    };
    for (const target of islands.values()) validateInteractive(target);
    for (const page of scan.pages.filter((page) => !page.island)) {
      for (const file of [page.componentPath, ...resolveEffectiveLayoutChain(page, scan.layouts, scan.namedLayouts).map((layout) => layout.filePath)]) validateInteractive(join(pagesDir, file));
    }
    // Match the official adapters: retain static-layout CSS in the client build
    // even when the document itself needs no client-side JavaScript. Reuse the
    // analysis snapshot rather than rereading modules during entry generation.
    cssImports = [...new Set([...pageFiles].flatMap(file => findStaticCssImports(analyses.get(file)!.code, file).map(item => rewriteCssImportForVirtualModule(item.statement, item.specifier, file))))];
    dependencyFiles = watched;
    const needsJS = new Set(directlyInteractive);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [file, dependencies] of graph) if (!needsJS.has(file) && [...dependencies].some((target) => needsJS.has(target))) { needsJS.add(file); changed = true; }
    }
    for (const page of scan.pages.filter((page) => page.island)) {
      const files = [page.componentPath, ...resolveEffectiveLayoutChain(page, scan.layouts, scan.namedLayouts).map((layout) => layout.filePath)];
      const hasIslands = files.some(file => needsJS.has(realpathSync(join(pagesDir, file))));
      const hasScript = markdown?.getClientScripts().has(page.componentId);
      if (hasIslands || hasScript) interactivePages.add(page.componentId);
      if (hasScript && !hasIslands) scriptOnlyPages.add(page.componentId);
    }
  }

  return {
    name: 'void-hono:islands',
    enforce: 'pre',
    configResolved(config) { markdown = markdownApi(config.plugins); },
    buildStart: rescan,
    async hotUpdate({ file, modules, timestamp }) {
      const inPages = normalizePath(file).startsWith(normalizePath(pagesDir) + '/');
      if (!inPages && !dependencyFiles.has(normalizePath(file))) return;
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
const scriptOnly = new Set(${JSON.stringify([...scriptOnlyPages])});
const markdownScripts = new Set(${JSON.stringify([...(markdown?.getClientScripts().keys() ?? [])])});
export function renderIslandPage(page, assets) {
  if (page.deferred?.length || page.deferredKeys) throw new Error('Hono islands: deferred props are unsupported.');
  if (!markdownScripts.has(page.component)) assets = { ...assets,
    body: assets.body.replace(/<script\\b[^>]*src=["'][^"']*(?:void-hono-markdown-client|markdown-client-)[^"']*["'][^>]*>\\s*<\\/script>/g, ''),
    preloads: assets.preloads.replace(/<link\\b[^>]*href=["'][^"']*markdown-client-[^"']*["'][^>]*>/g, ''),
  };
  if (!interactive.has(page.component)) return renderPage(page, { ...assets, preloads: '', body: '' });
  if (scriptOnly.has(page.component)) {
    // Keep the Markdown entry; its dynamic import loads only this page's code.
    // Framework preloads and the island scheduler have no work on this chain.
    const body = assets.body.replace(/<script\\b[^>]*src=["'][^"']*(?:void-islands-client|islands-client-)[^"']*["'][^>]*>\\s*<\\/script>/g, '');
    return renderPage(page, { ...assets, preloads: '', body });
  }
  return renderPage(page, assets);
}`;
      }
      if (id === `\0${ISLANDS_CLIENT_ENTRY_ID}`) {
        // Void owns dev first-paint CSS. Production needs the static imports
        // so its shared manifest asset collector can emit stylesheet links.
        const styles = this.environment?.mode === 'dev' ? '' : cssImports.join('\n');
        if (!islands.size || !interactivePages.size) return styles || 'export {};';
        const loaders = [...islands].map(([name, path]) => `${JSON.stringify(name)}: () => import(${JSON.stringify(path)})`).join(',\n');
        return `${styles}\n${markdown ? "import { MarkdownContext } from 'void-plugin-hono-jsx/markdown';" : ''}
import { initIslands } from 'void/pages-client';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
import { render } from 'hono/jsx/dom';
for (const element of document.querySelectorAll('[data-hydrate^="media:"]')) {
  const query = element.getAttribute('data-hydrate').slice(6).trim();
  if (matchMedia(query).media === 'not all' && query !== 'not all') throw new Error('Hono islands: invalid or unsupported media query ' + query);
}
initIslands({ ${loaders} }, (element, module, props) => {
  if (typeof module.default !== 'function') throw new Error('Hono islands: a component must export a default function.');
  let content = jsx(module.default, props);
  ${markdown ? `const metadata = JSON.parse(document.getElementById('app')?.getAttribute('data-hono-markdown') || '{}');
  const page = JSON.parse(document.getElementById('__VOID_PAGE_DATA__')?.textContent || '{}');
  content = jsx(MarkdownContext.Provider, { value: { frontmatter: metadata.frontmatter ?? {}, headings: metadata.headings ?? [], props: page.props ?? {} }, children: content });` : ''}
  render(content, element);
  element.setAttribute('data-hono-island', 'mounted');
});`;
      }
    },
  };
}
