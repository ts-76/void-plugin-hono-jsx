import 'void-plugin-hono-jsx/theme-content.css';
import { css } from 'hono/css';
import { HonoStyles } from 'void-plugin-hono-jsx/pages';
import { useFrontmatter, useMarkdownHeadings, useMarkdownProps } from 'void-plugin-hono-jsx/markdown';
export default function Layout({ children }: { children: unknown }) {
 const fm = useFrontmatter<{title: string}>(); const props = useMarkdownProps<{message?: string}>();
 return <><HonoStyles /><section id="markdown-layout" className="void-md"><header id="markdown-layout-title" class={css`border-top:3px solid rgb(12,34,56);`}>{fm.title}</header><output id="markdown-loader">{props.message ?? 'static'}</output><output id="markdown-headings">{useMarkdownHeadings().map(h => h.slug).join(',')}</output>{children}<a id="markdown-back" href="/">Home</a></section></>;
}
