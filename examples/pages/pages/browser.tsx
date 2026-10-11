import { useState } from 'hono/jsx';
import type { Props } from './browser.server';

// Evaluating this module on the server would throw, proving ssr=false isolation.
const userAgent = window.navigator.userAgent;

export default function BrowserPage({ initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  return (
    <main>
      <h1 id="browser-marker">Client-only page mounted</h1>
      <p id="browser-agent">{userAgent}</p>
      <output id="route-count">{count}</output>
      <button type="button" onClick={() => setCount((current) => current + 1)}>+1</button>
      <a href="/">Home</a>
    </main>
  );
}
