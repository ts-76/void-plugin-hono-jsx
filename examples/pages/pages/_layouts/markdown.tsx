import type { Child } from 'hono/jsx';
import { useFrontmatter, useMarkdownHeadings, useMarkdownProps } from '../../../../packages/hono-pages/src/runtime/markdown';
import { AppShell } from '../../src/AppShell';
import type { Props } from '../markdown.server';

export default function MarkdownLayout({ children }: { children: Child }) {
  const frontmatter = useFrontmatter<{ title: string; description: string; category: string }>();
  const headings = useMarkdownHeadings();
  const props = useMarkdownProps<Props>();
  return <AppShell documentNavigation>
    <main id="page-content" className="page-content">
      <div className="page-heading"><div><h1 id="markdown-title">{frontmatter.title}</h1><p>{frontmatter.description}</p></div></div>
      <div className="markdown-grid">
        <article className="panel markdown-prose">{children}</article>
        <aside className="panel markdown-meta">
          <div className="panel-heading"><h2>このページの情報</h2><p>Markdownのfrontmatterとサーバーデータ</p></div>
          <dl className="data-list"><div><dt>カテゴリー</dt><dd id="markdown-category">{frontmatter.category}</dd></div><div><dt>読み込み結果</dt><dd id="markdown-loader">{props.message}</dd></div></dl>
          <nav className="markdown-outline" aria-label="この記事の目次"><h2>目次</h2><ol>{headings.map(heading => <li key={heading.slug}><a href={'#' + heading.slug}>{heading.text}</a></li>)}</ol></nav>
          <p className="panel-description" id="markdown-script-status">ページスクリプトを読み込み中…</p>
        </aside>
      </div>
      <aside className="help-note"><strong>他のサンプルと行き来できます</strong><p>Markdownページでは画面全体を読み直します。カウンターは、このページを開いたときの初期値に戻ります。</p></aside>
    </main>
  </AppShell>;
}
