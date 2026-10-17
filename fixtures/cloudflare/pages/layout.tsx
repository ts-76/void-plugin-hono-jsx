import { useState, type Child } from 'hono/jsx';
import { Link } from 'void-plugin-hono-jsx/pages';
export default function Layout({ children }: { children: Child }) {
  const [count, setCount] = useState(0);
  return <><header>Temporary synthetic RC verification <output id="layout-count">{count}</output><button id="layout-increment" onClick={() => setCount(count + 1)}>Layout counter</button><nav><Link id="home" href="/">Home</Link> <Link id="other" href="/other">Other</Link> <a href="/island">Island</a> <a href="/markdown">Markdown</a></nav></header>{children}</>;
}
