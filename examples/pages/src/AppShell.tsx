import type { Child } from 'hono/jsx';
import { useRouter, useShared } from '../../../packages/hono-pages/src/runtime/pages';
import { Navigation } from './Navigation';
import { Icon } from './Icon';
import '../pages/style.css';

export function AppShell({ children }: { children: Child }) {
  const router = useRouter();
  const shared = useShared();
  const path = typeof shared.path === 'string' ? shared.path : '/';
  const section = path.startsWith('/users/') ? 'ユーザー' : path.startsWith('/layouts/') ? 'レイアウト' : path.startsWith('/head/') ? 'メタデータ' : ['/edit', '/named'].includes(path) ? 'フォーム' : path === '/browser' ? 'ブラウザ' : '概要';
  return <div className="app-shell">
    <a className="skip-link" href="#page-content">本文へ移動</a>
    <Navigation />
    <div className="workspace">
      <header className="workspace-header">
        <div className="breadcrumb"><span>サンプル</span><span aria-hidden="true">/</span><strong>{section}</strong></div>
        <div className="workspace-actions"><span className="environment-label">ローカル環境</span><button type="button" className="button button-quiet" id="nav-refresh" onClick={() => void router.refresh()}><Icon name="refresh" />更新</button></div>
      </header>
      <div className="navigation-progress" aria-hidden="true" />
      <div className="workspace-body">{children}</div>
      <footer className="workspace-footer"><span>Void Pages × Hono JSX</span><span>検証用サンプル・データは一時的に保持されます</span></footer>
    </div>
  </div>;
}
