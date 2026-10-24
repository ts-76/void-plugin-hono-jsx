import type { HonoMarkdownOptions } from './markdown-features.ts';
import { createContentParser, parseContent } from './markdown-content.ts';
import { parseSync, findIslandImports, editIslandSource } from './script-imports.ts';
import { parseDocument } from 'yaml';
import { configureComponentContainers } from './markdown-components.ts';
export { renderComponentChunks as renderChunks } from './markdown-components.ts';

export type { Heading } from './markdown-content.ts';
export function extractMarkdown(source: string) {
  const match = source.match(/^<script\b[^>]*>([\s\S]*?)<\/script>\s*\n?/);
  const script = match?.[1] ?? '';
  const body = match ? source.slice(match[0].length) : source;
  const imports = findIslandImports(script, 'markdown-script.ts');
  const parsed = parseSync('markdown-script.ts', script);
  if (parsed.errors.length) throw new Error('Hono Markdown: invalid script: ' + parsed.errors.map(error => error.message).join('; '));
  const declarations = parsed.program.body.filter(node => node.type === 'ImportDeclaration');
  const key = (attribute: NonNullable<(typeof declarations)[number]['attributes']>[number]) => 'name' in attribute.key ? attribute.key.name : attribute.key.value;
  const attributed = declarations.filter(node => node.attributes?.some(attribute => key(attribute) === 'island'));
  if (attributed.length !== imports.length) throw new Error('Hono Markdown: use one default component import with exactly one island attribute.');
  const staticImports = declarations.filter(node => node.attributes?.some(attribute => key(attribute) === 'component')).map(node => {
    if (node.attributes!.length !== 1 || node.attributes![0].value.value !== 'static' || node.specifiers.length !== 1 || node.specifiers[0].type !== 'ImportDefaultSpecifier' || node.importKind === 'type' || !/^[A-Z]\w*$/.test(node.specifiers[0].local.name)) throw new Error('Hono Markdown: use one default component import with { component: "static" }.');
    return { start: node.start!, end: node.end!, specifier: node.source.value, importName: node.specifiers[0].local.name };
  });
  const graphSource = [...imports.map(entry => script.slice(entry.start, entry.end)), ...staticImports.map(entry => `import ${entry.importName} from ${JSON.stringify(entry.specifier)};`)].join('\n');
  const clientCode = editIslandSource(script, [...imports, ...staticImports].map(entry => ({ start: entry.start, end: entry.end, text: '' }))).code.trim();
  return { body, script, imports, staticImports, graphSource, clientCode };
}

export function createMarkdownCompiler(options: HonoMarkdownOptions = {}) {
  const compiler = createContentParser(options, true);
  configureComponentContainers(compiler);
  function parse(source: string) {
    const extracted = extractMarkdown(source);
    const match = extracted.body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    let frontmatter: Record<string, unknown> = {};
    if (match) {
      const yaml = parseDocument(match[1], { uniqueKeys: true });
      if (yaml.errors.length) throw new Error('Hono Markdown: invalid frontmatter: ' + yaml.errors.map(error => error.message).join('; '));
      const value: unknown = yaml.toJS({ maxAliasCount: 50 });
      if (value !== null && (typeof value !== 'object' || Array.isArray(value))) throw new Error('Hono Markdown: frontmatter must be a mapping.');
      frontmatter = (value ?? {}) as Record<string, unknown>;
      try { JSON.stringify(frontmatter); } catch { throw new Error('Hono Markdown: frontmatter must be JSON serializable.'); }
    }
    const content = match ? extracted.body.slice(match[0].length) : extracted.body;
    const env: Record<string, unknown> = { components: new Set(extracted.staticImports.map(entry => entry.importName)) };
    return { ...extracted, source, content, frontmatter, ...parseContent(compiler, content, options, env) };
  }

  async function render(parsed: ReturnType<typeof parse>) {
    const { tokens, env, ...result } = parsed;
    return { ...result, html: await compiler.renderer.renderAsync(tokens, compiler.options, env) };
  }
  return { parse, render };
}

export async function compileMarkdown(source: string, options: HonoMarkdownOptions = {}) {
  const compiler = createMarkdownCompiler(options);
  return compiler.render(compiler.parse(source));
}
