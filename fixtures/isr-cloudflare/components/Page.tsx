import { useState } from 'hono/jsx';
import { Link } from 'void-plugin-hono-jsx/pages';
export default function Page(props: { fixture: string; path: string; version: number; renderId: number; viewer: string; revision: string; kind: string; unlisted: string; message: string }) {
  const [count, setCount] = useState(0);
  return <main><h1>ISR verification</h1><p>Synthetic data only</p>
    <nav><Link id="page-link" href="/page">Per-page TTL</Link> <Link id="global-link" href="/global">Global TTL</Link></nav>
    <dl><dt>Path</dt><dd id="isr-path">{props.path}</dd><dt>Revision</dt><dd id="isr-revision">{props.revision}</dd>
      <dt>Version</dt><dd id="isr-version">{props.version}</dd><dt>Render</dt><dd id="isr-render">{props.renderId}</dd>
      <dt>Viewer</dt><dd id="isr-viewer">{props.viewer}</dd></dl>
    <p id="isr-message">{props.message}</p><button id="isr-counter" onClick={() => setCount(n => n + 1)}>Count {count}</button>
  </main>;
}
