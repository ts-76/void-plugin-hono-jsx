import CodeGroup from '../honoxpress/code-group';
import { useFrontmatter, useMarkdownProps } from 'void-plugin-hono-jsx/markdown';
export default function CodeSamples({ label = 'Examples' }: { label?: string }) {
  const locale = useFrontmatter<{ locale: string }>().locale;
  const props = useMarkdownProps<{ message?: string }>();
  return <section id="hx-island-context" data-locale={locale} data-message={props.message}><CodeGroup ariaLabel={label} samples={[
    { label: 'TypeScript', code: 'const typed: string = "Hello";', filename: 'page.ts', copyLabel: locale === 'ja' ? 'コピー' : 'Copy' },
    { label: 'JavaScript', code: 'const typed = "Hello";', filename: 'page.js', copyLabel: locale === 'ja' ? 'コピー' : 'Copy' },
  ]} /></section>;
}
