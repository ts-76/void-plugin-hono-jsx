import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { normalizePath, parseSync, type Plugin } from 'vite';
import { scanPages, resolvePagesDir, type PageScanResult } from 'void/pages';
import {
  editIslandSource,
  computePagesNeedingClientJS,
  ISLANDS_RENDERER_ID,
  ISLANDS_CLIENT_ENTRY_ID,
} from 'void/pages-islands-plugin';

import { resolveComponent } from '../shared/resolve-component.ts';
import { islandClientPath, islandPagePath, markdownRuntimePath } from '../shared/runtime-paths.ts';

import { markdownApi, type HonoMarkdownApi } from '../markdown/api.ts';

import { analyzeIslands, islandImports, registerIslandImports } from './analysis.ts';

/** Hono mounting through Void's shared island scheduler. */
export function honoIslands(): Plugin {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  let islands = new Map<string, string>();
  let pageFiles = new Set<string>();
  let dependencyFiles = new Set<string>();
  let cssImports: string[] = [];
  let interactivePages = new Set<string>();
  let scriptOnlyPages = new Set<string>();
  let scan: PageScanResult | undefined;
  let markdown: HonoMarkdownApi | undefined;

  // Refresh before graph analysis, regardless of Markdown hot-hook order.
  async function rescan() {
    markdown?.refresh();
    const nextScan = await scanPages(root, { pagesDir });
    const next = analyzeIslands(root, pagesDir, nextScan, markdown, (file) =>
      dependencyFiles.add(file),
    );
    scan = nextScan;
    ({ islands, pageFiles, interactivePages, scriptOnlyPages, cssImports, dependencyFiles } = next);
  }

  return {
    name: 'void-hono:islands',
    enforce: 'pre',
    configResolved(config) {
      markdown = markdownApi(config.plugins);
    },
    buildStart: rescan,
    async hotUpdate({ file, modules, timestamp }) {
      const inPages = normalizePath(file).startsWith(normalizePath(pagesDir) + '/');
      if (!inPages && !dependencyFiles.has(normalizePath(file))) return;
      await rescan();
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
      if (!inPages && this.environment.config.consumer === 'client')
        this.environment.hot.send({ type: 'full-reload' });
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
      if (
        (pageFiles.has(canonical) || [...islands.values()].includes(canonical)) &&
        parseSync(filename, code).program.body.some(
          (node) =>
            node.type === 'ImportDeclaration' &&
            node.importKind !== 'type' &&
            ['void-plugin-hono-jsx/form', 'void-plugin-hono-jsx/pages'].includes(
              node.source.value,
            ) &&
            node.specifiers.some((entry) =>
              entry.type !== 'ImportSpecifier'
                ? node.source.value.endsWith('/form')
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
      if (!found.length) return;
      if (!pageFiles.has(canonical))
        throw new Error(
          'Hono islands: attributed imports require a static island page, layout or component graph; use ordinary imports inside interactive components.',
        );
      registerIslandImports(code, filename, root, islands);
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
        if (!islands.size || !interactivePages.size) return styles || 'export {};';
        const loaders = [...islands]
          .map(([name, path]) => `${JSON.stringify(name)}: () => import(${JSON.stringify(path)})`)
          .join(',\n');
        return `${styles}
import { startHonoIslands } from ${JSON.stringify(islandClientPath)};
startHonoIslands({ ${loaders} }, ${Boolean(markdown)});`;
      }
    },
  };
}
