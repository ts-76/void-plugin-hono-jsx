import { useState, type Child } from 'hono/jsx';
import { useShared, useParams } from '../../../packages/hono-pages/src/runtime/pages';

export function LayoutCounter({ name, children }: { name: string; children: Child }) {
  const [count, setCount] = useState(0);
  const shared = useShared();
  const params = useParams();
  return <section className="layout-scope" data-layout={name}>
    <div className="layout-state-bar">
      <span className="layout-state-label">{name === 'root' ? '共有レイアウト' : name === 'nested' ? '入れ子レイアウト' : '名前付きレイアウト'}</span>
      <span className="layout-counter-value">保持されたカウント <output id={`${name}-count`}>{count}</output></span>
      <button type="button" className="button button-small" id={`${name}-increment`} onClick={() => setCount((value) => value + 1)}>+1 増やす</button>
      <details className="request-context"><summary>リクエスト情報</summary><div className="request-context-content"><span>共有データ</span><code data-shared={name}>{JSON.stringify(shared)}</code><span>ルートパラメータ</span><code data-params={name}>{JSON.stringify(params)}</code></div></details>
    </div>
    {children}
  </section>;
}
