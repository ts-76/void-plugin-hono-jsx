import { useState, type Child } from 'hono/jsx';
export default function Layout({ children }: { children: Child }) {
  const [count, setCount] = useState(0);
  return <><aside><input id="consumer-layout-input" aria-label="Layout input" /><output id="consumer-layout-count">{count}</output><button id="consumer-layout-increment" onClick={() => setCount((value) => value + 1)}>Increment layout</button></aside>{children}</>;
}
