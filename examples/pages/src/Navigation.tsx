import { Link, useShared } from '../../../packages/hono-pages/src/runtime/pages';
import { useState } from 'hono/jsx';
import { Icon } from './Icon';

export function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const shared = useShared();
  const path = typeof shared.path === 'string' ? shared.path : '/';
  const active = (href: string) => path === href ? 'page' as const : undefined;
  return <aside className="sidebar">
    <Link className="brand" href="/"><span className="brand-symbol"><Icon name="code" /></span><span>Void Pages<small>Hono JSX サンプル</small></span></Link>
    <button className="button mobile-menu" type="button" aria-expanded={String(menuOpen)} aria-controls="pages-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? "閉じる" : "メニュー"}</button>
    <nav className="sidebar-navigation" id="pages-navigation" data-expanded={String(menuOpen)} aria-label="Pages" onClick={(event) => {
      if (event.target instanceof Element && event.target.closest('a')) setMenuOpen(false);
    }}>
      <Link className="nav-item" href="/" id="nav-home" aria-current={active('/')}><Icon name="home" />概要</Link>
      <div className="nav-group"><p className="nav-group-title">ユーザー</p>
        <Link className="nav-item" href="/users/alice?tab=profile" id="nav-alice" aria-current={active('/users/alice')}><Icon name="users" />Alice</Link>
        <Link className="nav-item" href="/users/bob" id="nav-bob" aria-current={active('/users/bob')}><Icon name="users" />Bob</Link>
      </div>
      <div className="nav-group"><p className="nav-group-title">機能を試す</p>
        <Link className="nav-item" href="/edit" aria-current={active('/edit')}><Icon name="form" />フォーム</Link>
        <Link className="nav-item" href="/named" aria-current={active('/named')}><Icon name="form" />名前付きアクション</Link>
        <Link className="nav-item" href="/layouts/one" aria-current={path.startsWith('/layouts/') ? 'page' : undefined}><Icon name="layers" />レイアウト</Link>
        <Link className="nav-item" href="/head/one" aria-current={path.startsWith('/head/') ? 'page' : undefined}><Icon name="head" />メタデータ</Link>
        <Link className="nav-item" href="/browser" id="nav-browser" aria-current={active('/browser')}><Icon name="browser" />ブラウザ専用ページ</Link>
      </div>
      <details className="navigation-tools" id="navigation-tools"><summary>検証ツール</summary><div className="tool-links">
        <Link href="/users/slow?delay=700" id="nav-slow">遅いページ</Link>
        <Link href="/users/failed?fail=1" id="nav-failed">失敗するページ</Link>
        <Link href="#route-value" id="nav-hash">値へ移動</Link>
        <Link href="/about" reloadDocument id="nav-reload">ドキュメントを再読込</Link>
        <Link href="https://example.com" id="nav-external">外部リンク</Link>
        <Link href="/about" download id="nav-download">ダウンロード</Link>
      </div></details>
    </nav>
    <div className="sidebar-note"><strong>実際の動作を確認できます</strong><p>画面遷移・状態の保持・フォーム送信を、このサンプルで試せます。</p></div>
  </aside>;
}
