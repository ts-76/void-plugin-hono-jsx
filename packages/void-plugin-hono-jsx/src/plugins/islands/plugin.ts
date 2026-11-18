import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { normalizePath, parseSync, type Plugin } from 'vite';
import { scanPages, resolvePagesDir, type PageScanResult } from 'void/pages';
import {
  createIslandManifest,
  editIslandSource,
  generateIslandClientEntry,
  computePagesNeedingClientJS,
  ISLANDS_RENDERER_ID,
  ISLANDS_CLIENT_ENTRY_ID,
} from 'void/pages-islands-plugin';

import { resolveComponent } from '../shared/resolve-component.ts';
import { islandClientPath, islandPagePath, markdownRuntimePath } from '../shared/runtime-paths.ts';

import { markdownApi, type HonoMarkdownApi } from '../markdown/api.ts';

import { analyzeIslands, islandImports, registerIslandImports } from './analysis.ts';

/** Lets the pages plugin keep a hot-swapped island edit from reloading the document. */
export type HonoIslandsApi = { hotSwapsIsland(file: string, timestamp: number): boolean };

/** Hono mounting through Void's shared island scheduler. */
export function honoIslands(): Plugin & { api: HonoIslandsApi } {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  let manifest = createIslandManifest(root, ['.tsx', '.jsx']);
  let pageFiles = new Set<string>();
  let dependencyFiles = new Set<string>();
  let cssImports: string[] = [];
  let interactivePages = new Set<string>();
  let scriptOnlyPages = new Set<string>();
  let scan: PageScanResult | undefined;
  let markdown: HonoMarkdownApi | undefined;
  let analyzedGraph = '';

  // Refresh before graph analysis, regardless of Markdown hot-hook order.
  async function rescan() {
    markdown?.refresh();
    const nextScan = await scanPages(root, { pagesDir });
    const next = analyzeIslands(root, pagesDir, nextScan, markdown, (file) =>
      dependencyFiles.add(file),
    );
    scan = nextScan;
    ({ manifest, pageFiles, interactivePages, scriptOnlyPages, cssImports, dependencyFiles } =
      next);
    // Transforms register more imports into the live manifest, so compare analyses only.
    analyzedGraph = graphSignature();
  }

  // Compares real paths, since a project can be reached through a symbolic link.
  function islandIds(file: string) {
    const real = (path: string) => {
      try {
        return normalizePath(realpathSync(path));
      } catch {
        return normalizePath(path);
      }
    };
    const target = real(file);
    return [...manifest.entries.values()]
      .filter((entry) => real(entry.componentPath) === target)
      .map((entry) => entry.islandId);
  }
  // Everything that decides which modules are islands, pages and stylesheets.
  function graphSignature() {
    const sorted = (values: Iterable<string>) => [...values].sort();
    return JSON.stringify([
      sorted(
        [...manifest.entries.values()].map((e) =>
          [e.islandId, e.componentPath, e.hydrate].join('\0'),
        ),
      ),
      sorted(pageFiles),
      sorted(interactivePages),
      sorted(scriptOnlyPages),
      sorted(cssImports),
    ]);
  }
  // Files given an HMR handler. Vite would otherwise apply their removal, or an
  // edit after they leave the island graph, as a hot update the page cannot load.
  const hotAccepting = new Set<string>();
  // Both the client and worker environments receive each edit; decide once per edit.
  let hotSwap = { key: '', swaps: false };
  async function decideHotSwap(file: string, type: string, timestamp: number) {
    const key = file + '\0' + timestamp;
    if (hotSwap.key === key) return hotSwap.swaps;
    const before = analyzedGraph;
    // Additions and removals change the graph; a removed file has no real path.
    const wasIsland = type === 'update' && islandIds(file).length > 0;
    await rescan();
    hotSwap = { key, swaps: wasIsland && analyzedGraph === before };
    return hotSwap.swaps;
  }

  return {
    name: 'void-hono:islands',
    enforce: 'pre',
    configResolved(config) {
      markdown = markdownApi(config.plugins);
    },
    buildStart: rescan,
    api: {
      hotSwapsIsland: (file, timestamp) => hotSwap.key === file + '\0' + timestamp && hotSwap.swaps,
    },
    async hotUpdate({ file, type, modules, timestamp }) {
      const path = normalizePath(file);
      const inPages = path.startsWith(normalizePath(pagesDir) + '/');
      if (!inPages && !dependencyFiles.has(path) && !hotAccepting.has(path)) return;
      // An edit to an island component that keeps the island graph is applied by
      // the component's own HMR handler instead of a document reload.
      const swaps = await decideHotSwap(file, type, timestamp);
      const invalidated = new Set<(typeof modules)[number]>();
      for (const id of [
        ISLANDS_RENDERER_ID,
        ISLANDS_CLIENT_ENTRY_ID,
        'virtual:void-pages-renderer',
      ]) {
        const module = this.environment.moduleGraph.getModuleById(`\0${id}`);
        if (module)
          this.environment.moduleGraph.invalidateModule(module, invalidated, timestamp, true);
      }
      if (!swaps && !inPages && this.environment.config.consumer === 'client') {
        this.environment.hot.send({ type: 'full-reload' });
        return [];
      }
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
      const hotIds =
        this.environment?.mode === 'dev' && this.environment.config.consumer === 'client'
          ? islandIds(canonical)
          : [];
      if (hotIds.length) hotAccepting.add(normalizePath(filename));
      // Development: an edited island component renders its mounted islands again.
      const hmr = hotIds.length
        ? `
import { remountHonoIslands as __remountHonoIslands } from ${JSON.stringify(islandClientPath)};
if (import.meta.hot)
  import.meta.hot.accept((next) => {
    if (!next || !__remountHonoIslands(${JSON.stringify(hotIds)}, next)) import.meta.hot.invalidate();
  });
`
        : '';
      if (
        (pageFiles.has(canonical) ||
          [...manifest.entries.values()].some((entry) => entry.componentPath === canonical)) &&
        parseSync(filename, code).program.body.some(
          (node) =>
            node.type === 'ImportDeclaration' &&
            node.importKind !== 'type' &&
            node.source.value === 'void-plugin-hono-jsx' &&
            node.specifiers.some((entry) =>
              entry.type !== 'ImportSpecifier'
                ? true
                : entry.importKind !== 'type' &&
                  ['useForm', 'action', 'setActionRouter'].includes(
                    'name' in entry.imported ? entry.imported.name : entry.imported.value,
                  ),
            ),
        )
      ) {
        throw new Error(
          'Hono islands: useForm/action require full Pages; use named useIslandForm/Form imports for islands.',
        );
      }
      const found = islandImports(code, filename);
      if (!found.length) return hmr ? editIslandSource(code, [], { append: hmr }) : undefined;
      if (!pageFiles.has(canonical))
        throw new Error(
          'Hono islands: attributed imports require a static island page, layout or component graph; use ordinary imports inside interactive components.',
        );
      registerIslandImports(code, filename, root, manifest);
      // Void requests static modules in the client environment to collect CSS.
      // Actual interactive entry graphs were validated above; strip attributes
      // for that traversal rather than generating server-only marker wrappers.
      if (this.environment?.config.consumer === 'client')
        return editIslandSource(
          code,
          found.map((entry) => ({
            start: entry.start,
            end: entry.end,
            text: `import ${entry.importName} from ${entry.specifierRaw};`,
          })),
          { append: hmr },
        );
      return editIslandSource(
        code,
        found.map((entry) => {
          const path = resolveComponent(entry.specifier, join(filename, '..'), ['.tsx', '.jsx']);
          if (!path) throw new Error(`Hono islands: missing component ${entry.specifier}.`);
          const islandId = normalizePath(relative(root, realpathSync(path)));
          const component = `__honoIslandComponent${entry.start}`;
          return {
            start: entry.start,
            end: entry.end,
            text: `import ${component} from ${entry.specifierRaw};
const ${entry.importName} = (props) => {
  let content = __honoIslandJsx(${component}, props);
  ${
    markdown
      ? `const metadata = __honoIslandUseContext(__honoIslandMarkdownContext);
  if (metadata.clientFrontmatter !== undefined && metadata.clientFrontmatter !== metadata.frontmatter) content = __honoIslandJsx(__honoIslandMarkdownContext.Provider, { value: { ...metadata, frontmatter: metadata.clientFrontmatter }, children: content });`
      : ''
  }
  return __honoIslandJsx('div', { 'data-island': ${JSON.stringify(islandId)}, 'data-hydrate': ${JSON.stringify(entry.hydrate)}, 'data-props': JSON.stringify(props), children: content });
};`,
          };
        }),
        {
          prepend:
            "import { jsx as __honoIslandJsx } from 'hono/jsx/jsx-runtime';\n" +
            (markdown
              ? `import { useContext as __honoIslandUseContext } from 'hono/jsx';\nimport { MarkdownContext as __honoIslandMarkdownContext } from ${JSON.stringify(markdownRuntimePath)};\n`
              : ''),
        },
      );
    },
    load(id) {
      if (id === `\0${ISLANDS_RENDERER_ID}`) {
        if (!scan) throw new Error('Hono islands: page discovery has not completed.');
        const interactive = [
          ...new Set([...computePagesNeedingClientJS(scan, pagesDir, null), ...interactivePages]),
        ];
        return `import { renderPage } from 'virtual:void-pages-renderer';
import { createHonoIslandRenderer } from ${JSON.stringify(islandPagePath)};
const interactive = new Set(${JSON.stringify(interactive)});
const scriptOnly = new Set(${JSON.stringify([...scriptOnlyPages])});
const markdownScripts = new Set(${JSON.stringify([...(markdown?.getClientScripts().keys() ?? [])])});
export const renderIslandPage = createHonoIslandRenderer(renderPage, { interactive, scriptOnly, markdownScripts });`;
      }
      if (id === `\0${ISLANDS_CLIENT_ENTRY_ID}`) {
        // Void owns dev first-paint CSS. Production needs the static imports
        // so its shared manifest asset collector can emit stylesheet links.
        const styles = this.environment?.mode === 'dev' ? '' : cssImports.join('\n');
        if (!manifest.entries.size || !interactivePages.size) return styles || 'export {};';
        const entry = generateIslandClientEntry({
          manifest,
          // The validated graph already supplies CSS for layouts and Markdown.
          cssFiles: new Set(),
          styles: null,
          needsRuntime: true,
          isDev: this.environment?.mode === 'dev',
          // Import the Markdown context only when Markdown is enabled, so the
          // optional package stays out of other applications' graphs.
          hydrateIsland: markdown
            ? `import { createHonoIslandMounter } from ${JSON.stringify(islandClientPath)};
import { MarkdownContext as __honoMarkdownContext } from ${JSON.stringify(markdownRuntimePath)};
const hydrateIsland = createHonoIslandMounter(__honoMarkdownContext);`
            : `import { createHonoIslandMounter } from ${JSON.stringify(islandClientPath)};
const hydrateIsland = createHonoIslandMounter();`,
        });
        return styles ? styles + '\n' + entry : entry;
      }
    },
  };
}
