import { useState } from 'hono/jsx';
import type { Props } from './browser.server';

// Evaluating this module on the server would throw, proving ssr=false isolation.
const userAgent = window.navigator.userAgent;

export default function BrowserPage({ initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  return <main id="page-content" className="page-content"><div className="page-heading"><div><h1 id="browser-marker">ブラウザ専用ページ</h1><p>ブラウザの API を使うページを、クライアント側で表示しています。</p></div></div><div className="content-grid"><section className="panel"><div className="panel-heading"><h2>ブラウザ情報</h2><p>現在のブラウザから取得したユーザーエージェント</p></div><p id="browser-agent" className="technical-value">{userAgent}</p></section><section className="panel"><div className="panel-heading"><h2>ページのカウンター</h2><p>サーバーの初期値から開始します。</p></div><div className="counter-controls"><output id="route-count" aria-live="polite">{count}</output><button className="button button-primary" type="button" onClick={() => setCount((current) => current + 1)}>+1 増やす</button></div></section></div></main>;
}
