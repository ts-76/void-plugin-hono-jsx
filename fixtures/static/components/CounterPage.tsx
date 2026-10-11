import { useState } from 'hono/jsx';
import { Link } from 'void-plugin-hono-jsx/pages';
export default function CounterPage({ label, initialCount, message }: { label: string; initialCount: number; message: string }) {
  const [count, setCount] = useState(initialCount);
  return <main><h1 id="static-label">{label}</h1><p id="static-message">{message}</p><output id="static-count">{count}</output>
    <button id="static-increment" onClick={() => setCount((value) => value + 1)}>Increment static counter</button>
    <Link id="static-alice" href="/users/alice">Alice</Link><Link id="static-bob" href="/users/bob">Bob</Link><Link id="static-home" href="/">Home</Link>
  </main>;
}
