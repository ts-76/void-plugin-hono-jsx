import { useFrontmatter, useMarkdownHeadings, useMarkdownProps } from 'void-plugin-hono-jsx/markdown';
export default function Layout({ children }: { children: unknown }) {
 const fm = useFrontmatter<{title: string}>(); const props = useMarkdownProps<{message?: string}>();
 return <section id="markdown-layout"><header id="markdown-layout-title">{fm.title}</header><output id="markdown-loader">{props.message ?? 'static'}</output><output id="markdown-headings">{useMarkdownHeadings().map(h => h.slug).join(',')}</output>{children}<a id="markdown-back" href="/">Home</a></section>;
}
