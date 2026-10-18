import { createDocsCatalogFromPages } from 'honoxpress';
import type { MarkdownHeading } from 'void-plugin-hono-jsx/markdown';
// Explicit identity comes from application metadata, never HonoX path inference.
const modules = import.meta.glob('./pages/hx/*/*.md', { eager: true }) as Record<string, { frontmatter: { locale: string; slug: string; href: string; title: string }; headings: MarkdownHeading[] }>;
export const catalog = createDocsCatalogFromPages({ locales: ['en', 'ja'], defaultLocale: 'en', pages: Object.values(modules).map(({ frontmatter, headings }) => ({ ...frontmatter, headings: headings.map(({ slug, ...heading }) => ({ ...heading, id: slug })) })) });
