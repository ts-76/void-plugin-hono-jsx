import container from 'markdown-it-container';
import MarkdownExit from 'markdown-exit';

const unescapeAttribute = new MarkdownExit().utils.unescapeAll;

/** Data only: never evaluate JSX expressions or allow renderer-owned props. */
export function componentAttributes(source: string, restricted = true) {
  const props: Record<string, string | boolean> = Object.create(null);
  const attribute = /\s+(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y;
  let cursor = 0;
  while (source.slice(cursor).trim()) {
    attribute.lastIndex = cursor;
    const match = attribute.exec(source);
    if (!match) throw new Error('Hono Markdown: use literal component attributes; JSX expressions are unsupported.');
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    if (Object.hasOwn(props, key) || match[4]?.startsWith('{') || restricted && (!/^[A-Za-z]/.test(key) || /^(?:children|key|ref|dangerouslySetInnerHTML|__proto__|prototype|constructor)$/i.test(key) || /^on/i.test(key))) throw new Error(`Hono Markdown: invalid or reserved component attribute ${key}.`);
    props[key] = value === undefined ? true : unescapeAttribute(value);
    cursor = attribute.lastIndex;
  }
  return props;
}

/** Reuse Markdown's block parser so nested headings/references retain page scope. */
export function configureComponentContainers(md: MarkdownExit) {
  md.use(container, 'component', {
    render(tokens: Parameters<NonNullable<typeof md.renderer.rules.fence>>[0], index: number) {
      const token = tokens[index];
      if (token.nesting !== 1) return `</${token.meta.name}>\n`;
      const attributes = Object.entries(token.meta.props).map(([key, value]) => value === true ? ` ${key}` : ` ${key}="${md.utils.escapeHtml(String(value))}"`).join('');
      return `<${token.meta.name}${attributes}>\n`;
    },
  });
  // Validate once while constructing the complete scan snapshot. Pairing here
  // also avoids walking backward through every nested subtree during emission.
  md.core.ruler.after('block', 'hono_component_metadata', state => {
    const stack: Array<{ name: string; props: Record<string, string | boolean> }> = [];
    for (const token of state.tokens) {
      if (token.type === 'container_component_open') {
        const match = /^component\s+([A-Z]\w*)([\s\S]*)$/.exec(token.info.trim());
        if (!match || !state.env.components.has(match[1])) throw new Error('Hono Markdown: component containers require a declared static component import.');
        token.meta = { name: match[1], props: componentAttributes(match[2]) };
        stack.push(token.meta);
      } else if (token.type === 'container_component_close') token.meta = stack.pop();
    }
  });
}

export type MarkdownChunk = { html: string } | { name: string; props: Record<string, string | boolean>; children?: MarkdownChunk[] };

export function renderComponentChunks(html: string, names: Set<string>, staticNames = new Set<string>()) {
  const root: MarkdownChunk[] = [];
  const stack: Array<{ name: string; children: MarkdownChunk[] }> = [];
  let chunks = root;
  let cursor = 0;
  // Raw-text elements and comments are authored HTML, never component syntax.
  const tags = /<!--[\s\S]*?-->|<(script|style|textarea|pre)\b[^>]*>[\s\S]*?<\/\1\s*>|<(\/?)([A-Z]\w*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  for (const match of html.matchAll(tags)) {
    const name = match[3];
    if (!names.has(name)) continue;
    if (match.index > cursor) chunks.push({ html: html.slice(cursor, match.index) });
    if (match[2]) {
      if (stack.at(-1)?.name !== name) throw new Error(`Hono Markdown: mismatched component closing tag ${name}.`);
      if (!staticNames.has(name) && chunks.some(chunk => !('html' in chunk) || chunk.html.trim())) throw new Error('Hono Markdown: island tag children are unsupported; use a TSX wrapper.');
      stack.pop();
      chunks = stack.at(-1)?.children ?? root;
    } else {
      const selfClosing = /\/\s*$/.test(match[4]);
      const child: MarkdownChunk & { name: string } = { name, props: componentAttributes(selfClosing ? match[4].replace(/\/\s*$/, '') : match[4], staticNames.has(name)) };
      chunks.push(child);
      if (!selfClosing) {
        child.children = [];
        stack.push({ name, children: child.children });
        chunks = child.children;
      }
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < html.length) chunks.push({ html: html.slice(cursor) });
  if (stack.length) throw new Error(`Hono Markdown: unclosed component ${stack.at(-1)!.name}.`);
  return root;
}
