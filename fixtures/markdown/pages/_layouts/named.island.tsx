import { useFrontmatter } from 'void-plugin-hono-jsx/markdown';
export default function Layout({ children }: { children: unknown }) { return <aside id="markdown-named"><output id="markdown-named-title">{String(useFrontmatter().title)}</output>{children}</aside>; }
