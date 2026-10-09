import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateComponentManifest, resolvePagesDir, resolveStaticPageDataBuildOptions, scanPages, type PageScanResult } from 'void/pages';
import type { Plugin } from 'vite';
import { honoJsx } from './hono-jsx.ts';

const rendererId = 'virtual:void-pages-renderer';
const clientId = 'virtual:void-pages-client';

/** Experimental Pages contract verified against Void 0.26.0. */
export function voidHonoPages(): Plugin[] {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  let scan: PageScanResult | undefined;

  async function rescan() {
    scan = await scanPages(root, { pagesDir });
    if (scan.layouts.length || scan.namedLayouts.length) {
      throw new Error('Hono Pages: layouts are not supported yet (issue #4).');
    }
    for (const page of scan.pages) {
      if (!/\.[jt]sx$/.test(page.componentPath) || page.renderMode !== 'server') {
        throw new Error(`Hono Pages: only SSR TSX/JSX pages are supported: ${page.componentPath}.`);
      }
      if (page.methods.some((method) => method !== 'loader')) {
        throw new Error(`Hono Pages: actions are not supported yet (issue #5): ${page.componentPath}.`);
      }
      if (page.prerender === true) {
        throw new Error('Hono Pages: prerendering is not supported yet (issue #10).');
      }
    }
  }

  return [honoJsx(), {
    name: 'void-hono:pages',
    config() {
      const require = createRequire(import.meta.url);
      const packagePath = join(dirname(require.resolve('void')), '..', 'package.json');
      const { version } = JSON.parse(readFileSync(packagePath, 'utf8')) as { version: string };
      if (version !== '0.26.0') {
        throw new Error(`Hono Pages: Void ${version} is unverified; this experimental adapter requires 0.26.0.`);
      }
      if (resolveStaticPageDataBuildOptions(root).enabled) {
        throw new Error('Hono Pages: static output is not supported yet (issue #10).');
      }
      return {
        resolve: { dedupe: ['hono'] },
        build: { manifest: true, rollupOptions: { input: { 'pages-client': clientId } } },
      };
    },
    async buildStart() {
      await rescan();
    },
    resolveId(id) {
      if (id === rendererId || id === clientId) return `\0${id}`;
    },
    async load(id) {
      if (id !== `\0${rendererId}` && id !== `\0${clientId}`) return;
      if (!scan) await rescan();
      const manifest = generateComponentManifest(scan!, pagesDir);
      if (id === `\0${rendererId}`) {
        return `
import { jsx } from 'hono/jsx';
import { serializePageData } from 'void/pages-server';
import { renderHeadToString, renderHtmlAttrs, renderBodyAttrs } from 'void/pages-head';
${manifest}
export async function renderPage(pageObj, assetTags) {
  if (pageObj.deferred?.length || pageObj.deferredKeys) {
    throw new Error('Hono Pages: deferred props are not supported yet (issue #9).');
  }
  const load = components[pageObj.component];
  if (!load) throw new Error('Hono Pages: unknown page component ' + pageObj.component);
  const { default: Page } = await load();
  const markup = await jsx(Page, pageObj.props).toString();
  const head = pageObj.head;
  return '<!doctype html><html' + (head ? renderHtmlAttrs(head) : '') + '><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">'
    + (head ? renderHeadToString(head) : '') + assetTags.css + assetTags.preloads
    + '</head><body' + (head ? renderBodyAttrs(head) : '') + '>'
    + '<script id="__VOID_PAGE_DATA__" type="application/json">' + serializePageData(pageObj) + '</script>'
    + '<div id="app">' + markup + '</div>' + assetTags.body + '</body></html>';
}
`;
      }
      return `
import { render } from 'hono/jsx/dom';
import { jsx } from 'hono/jsx/dom/jsx-runtime';
${manifest}
const data = document.getElementById('__VOID_PAGE_DATA__');
const root = document.getElementById('app');
if (!data || !root) throw new Error('Hono Pages: initial page data or app root is missing.');
const page = JSON.parse(data.textContent);
const load = components[page.component];
if (!load) throw new Error('Hono Pages: unknown page component ' + page.component);
const { default: Page } = await load();
render(jsx(Page, page.props), root);
root.dataset.honoPages = 'mounted';
`;
    },
  }];
}
