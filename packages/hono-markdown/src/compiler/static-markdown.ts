import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { compileMarkdown, createMarkdownCompiler, renderChunks } from './markdown-compiler.ts';
import { resolveComponent } from './resolve-component.ts';
import { markdownCopyCode } from './markdown-copy.ts';
import type { HonoMarkdownOptions } from './markdown-features.ts';

export type { HonoMarkdownOptions } from './markdown-features.ts';

export interface MarkdownIsland { id: string; modulePath: string; hydrate: string }

/** Read the shared prelude without accepting arbitrary browser scripts. */
export function readMarkdownModule(source: string) {
  const { frontmatter, content, script, clientCode } = createMarkdownCompiler().parse(source);
  if (clientCode) throw new Error('Hono Markdown: standalone modules accept component imports only; arbitrary scripts require a host-specific page compiler.');
  return { frontmatter, content, script };
}

/** Read YAML and the shared static-import prelude before splitting slides. */
export function readStaticMarkdown(source: string) {
  const { frontmatter, content, script, imports, clientCode } = createMarkdownCompiler().parse(source);
  if (imports.length || clientCode) throw new Error('Hono Markdown: standalone slides support static components only; page islands and scripts require a host-specific page compiler.');
  return { frontmatter, content, script };
}

/** Compile trusted Markdown for a host that owns its document and client entry. */
export async function compileStaticMarkdown(source: string, input: { sourcePath: string; options?: HonoMarkdownOptions }) {
  readStaticMarkdown(source);
  return compileMarkdownModule(source, input);
}

/** Compile an independent document with structured island metadata for its host. */
export async function compileMarkdownModule(source: string, input: { sourcePath: string; options?: HonoMarkdownOptions }) {
  readMarkdownModule(source);
  const result = await compileMarkdown(source, input.options);
  const imports = [...result.staticImports.map(entry => ({ ...entry, kind: 'static' as const, hydrate: '' })), ...result.imports.map(entry => ({ ...entry, kind: 'island' as const }))].map((entry, index) => {
    const target = entry.specifier.startsWith('.') && resolveComponent(entry.specifier, dirname(input.sourcePath), ['.tsx', '.jsx']);
    if (!target) throw new Error(`Hono Markdown: cannot resolve relative TSX/JSX component ${entry.specifier} in ${input.sourcePath}.`);
    if (entry.kind === 'island' && !['load', 'visible', 'idle'].includes(entry.hydrate)) {
      const query = entry.hydrate.startsWith('media:') ? entry.hydrate.slice(6).trim() : '';
      let balance = 0;
      let invalid = false;
      for (const character of query) { if (character === '(') balance++; if (character === ')') balance--; if (balance < 0) invalid = true; }
      if (!query || balance || invalid || /[{};]/.test(query)) throw new Error(`Hono Markdown: invalid island hydration policy ${entry.hydrate}.`);
    }
    return { ...entry, alias: `__component${index}`, modulePath: target, id: 'md-' + createHash('sha256').update(target).digest('hex').slice(0, 16) };
  });
  const names = new Set(imports.map(entry => entry.importName));
  const chunks = renderChunks(result.html, names, new Set(result.staticImports.map(entry => entry.importName)));
  const literal = (value: unknown) => `JSON.parse(${JSON.stringify(JSON.stringify(value))})`;
  const emit = (chunk: (typeof chunks)[number]): string => {
    if ('html' in chunk) return `raw(${JSON.stringify(chunk.html)})`;
    const entry = imports.find(entry => entry.importName === chunk.name)!;
    if (entry.kind === 'island') return `jsx('div', { 'data-hono-md-island': ${JSON.stringify(entry.id)}, 'data-hono-md-hydrate': ${JSON.stringify(entry.hydrate)}, 'data-hono-md-props': JSON.stringify(${literal(chunk.props)}), 'data-hono-md-context': JSON.stringify({ frontmatter, headings, props: {} }), children: jsx(${entry.alias}, ${literal(chunk.props)}) })`;
    return `jsx(${entry.alias}, { ...${literal(chunk.props)}${chunk.children ? `, children: [${chunk.children.map(emit).join(',')}]` : ''} })`;
  };
  return {
    islands: imports.filter(entry => entry.kind === 'island').map(({ id, modulePath, hydrate }) => ({ id, modulePath, hydrate })) satisfies MarkdownIsland[],
    frontmatter: result.frontmatter,
    headings: result.headings,
    clientCode: result.hasCode ? markdownCopyCode : '',
    code: `import { jsx, Fragment } from 'hono/jsx/jsx-runtime';
import { raw } from 'hono/html';
import { MarkdownContext } from '@ts-76/hono-markdown';
${imports.map(entry => `import ${entry.alias} from ${JSON.stringify(entry.specifier)};`).join('\n')}
export const frontmatter = ${literal(result.frontmatter)};
export const headings = ${literal(result.headings)};
export default function MarkdownSlide() {
  return jsx(MarkdownContext.Provider, { value: { frontmatter, headings, props: {} }, children: jsx('div', { class: 'void-md', children: jsx(Fragment, { children: [${chunks.map(emit).join(',')}] }) }) });
}`,
  };
}
