export * from '@ts-76/hono-markdown/compiler';

import {
  compileMarkdownModule as compileModule,
  compileStaticMarkdown as compileStatic,
  type MarkdownModuleInput,
} from '@ts-76/hono-markdown/compiler';

type AdapterMarkdownInput = Omit<MarkdownModuleInput, 'contextModule'>;

// Generated application modules can resolve the adapter they installed even
// when its shared compiler dependency is isolated by the package manager.
export function compileMarkdownModule(source: string, input: AdapterMarkdownInput) {
  return compileModule(source, { ...input, contextModule: 'void-plugin-hono-jsx/markdown' });
}

export function compileStaticMarkdown(source: string, input: AdapterMarkdownInput) {
  return compileStatic(source, { ...input, contextModule: 'void-plugin-hono-jsx/markdown' });
}
