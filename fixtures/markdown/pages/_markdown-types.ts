import { voidHonoMarkdown } from 'void-plugin-hono-jsx/markdown/plugin';
import { useFrontmatter, useMarkdownHeadings, useMarkdownProps } from 'void-plugin-hono-jsx/markdown';
voidHonoMarkdown();
const title: string = useFrontmatter<{title: string}>().title;
const message: string = useMarkdownProps<{message: string}>().message;
const depth: number | undefined = useMarkdownHeadings()[0]?.depth;
void [title, message, depth];
