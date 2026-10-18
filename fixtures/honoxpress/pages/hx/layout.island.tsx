import type { Child } from 'hono/jsx';
import { HonoStyles } from 'void-plugin-hono-jsx/pages';
import { useFrontmatter, useMarkdownProps } from 'void-plugin-hono-jsx/markdown';
import { DocsFrame } from '../../components/honoxpress/docs-layout';
import { ThemeScript } from '../../components/honoxpress/theme-switch';
import { catalog } from '../../hx-catalog';
import '../../hx.css';
export default function Layout({ children }: { children: Child }) {
  const fm = useFrontmatter<{ title: string; locale: string; href: string; interactive?: boolean }>();
  const props = useMarkdownProps<{ nonce?: string }>();
  return <><HonoStyles nonce={props.nonce} />{fm.interactive && <ThemeScript nonce={props.nonce} />}<DocsFrame current={catalog.page(fm.href)} pages={catalog.navigation(fm.locale)} translations={catalog.translations(fm.href)} locale={fm.locale} config={{ name: 'honoxpress', defaultLocale: 'en', localeLabels: { en: 'EN', ja: 'JA' }, themeSwitch: fm.interactive === true, homeHref: '/' }}>{children}</DocsFrame></>;
}
