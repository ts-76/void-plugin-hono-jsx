import { useState } from 'hono/jsx';
import { Link } from '../../../packages/hono-pages/src/runtime/pages';
import type { Props } from './index.server';
import { Icon } from '../src/Icon';

export default function Page({ initialCount, message }: Props) {
  const [count, setCount] = useState(initialCount);
  return <main id="page-content" className="page-content">
    <div className="page-heading"><div><h1>サンプルの概要</h1><p>Void Pages と Hono JSX を使った、画面遷移・フォーム・Markdownの動作を試せます。</p></div></div>
    <div className="content-grid"><section className="panel"><div className="panel-heading"><h2>はじめに試す</h2><p>各ページで実際の動作を確認してください。</p></div>
      <div className="feature-list"><Link href="/users/bob"><Icon name="users" /><span><strong>ユーザーの切り替え</strong><small>URL と状態の変化を確認</small></span><Icon name="arrow" /></Link><Link href="/edit"><Icon name="form" /><span><strong>フォームの送信</strong><small>入力・保存・バリデーションを確認</small></span><Icon name="arrow" /></Link><Link href="/layouts/one"><Icon name="layers" /><span><strong>レイアウトの共有</strong><small>画面をまたいだ状態の保持を確認</small></span><Icon name="arrow" /></Link><Link href="/markdown"><Icon name="form" /><span><strong>Markdownを表示</strong><small>本文・表・カウンターを確認</small></span><Icon name="arrow" /></Link></div>
    </section><section className="panel" aria-label="Counter"><div className="panel-heading"><h2>サーバーからの初期値</h2><p>読み込み時の値を使ったカウンター</p></div><div className="counter-controls"><output id="count" aria-live="polite">{count}</output><button className="button button-primary" type="button" onClick={() => setCount((value) => value + 1)}>+1 増やす</button><button className="button" type="button" onClick={() => setCount(initialCount)}>リセット</button></div><p className="panel-description">再読み込みするとサーバーの初期値に戻ります。</p></section></div>
    <details className="diagnostic-panel"><summary>サーバーデータを確認</summary><div><p id="loader-marker">Server loader initial count: {initialCount}</p><p id="serialized-message">{message}</p></div></details>
  </main>;
}
