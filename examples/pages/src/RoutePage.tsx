import { useState } from 'hono/jsx';
import { Link } from '../../../packages/hono-pages/src/runtime/pages';

type RouteProps = { label: string; value: string };

export function RoutePage({ label, value }: RouteProps) {
  const [count, setCount] = useState(0);
  const user = label === 'User';
  const displayName = value.charAt(0).toUpperCase() + value.slice(1);
  return <main id="page-content" className="page-content">
    <div className="page-heading"><div><h1>{user ? `${displayName} のプロフィール` : label}</h1><p>{user ? 'ユーザーごとの画面遷移と、ページ内の状態を確認できます。' : 'このルートの表示内容と、状態の保持を確認できます。'}</p></div>
      {user && <Link className="button button-primary" href="/edit">フォームを試す</Link>}
    </div>
    <div className="content-grid">
      <section className="panel"><div className="panel-heading"><h2>{user ? 'ユーザー情報' : 'ルート情報'}</h2><p>サーバーから取得した表示内容</p></div>
        <div className="profile-summary"><span className="avatar" aria-hidden="true">{displayName.charAt(0)}</span><div><h3>{displayName}</h3><span className="muted">{user ? 'サンプルユーザー' : '表示中のルート'}</span></div></div>
        <dl className="data-list"><div><dt>{user ? 'ユーザー ID' : 'ルートの値'}</dt><dd><p id="route-value">{value}</p></dd></div><div><dt>表示方法</dt><dd>サーバーレンダリング + クライアント遷移</dd></div></dl>
        {user && <div className="panel-footer"><span>別のユーザーを表示</span><Link href={value === 'alice' ? '/users/bob' : '/users/alice?tab=profile'}>{value === 'alice' ? 'Bob' : 'Alice'} →</Link></div>}
      </section>
      <section className="panel"><div className="panel-heading"><h2>ページのカウンター</h2><p>このページで保持している状態</p></div><div className="counter-controls"><output id="route-count" aria-live="polite">{count}</output><button className="button button-primary" type="button" onClick={() => setCount((current) => current + 1)}>+1 増やす</button></div><p className="panel-description">上部の「更新」では値を保持します。別のユーザーへ移動すると、ページのカウンターは 0 に戻ります。</p></section>
    </div>
    <aside className="help-note"><strong>共有レイアウトの状態も確認できます</strong><p>上部のカウントは、ユーザーを切り替えても保持されます。「リクエスト情報」から現在のパラメータを確認できます。</p></aside>
  </main>;
}
