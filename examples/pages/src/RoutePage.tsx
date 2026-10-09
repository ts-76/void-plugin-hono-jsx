import { useState } from 'hono/jsx';

type RouteProps = { label: string; value: string };

export function RoutePage({ label, value }: RouteProps) {
  const [count, setCount] = useState(0);
  return (
    <main>
      <h1>{label}</h1>
      <p id="route-value">{value}</p>
      <output id="route-count">{count}</output>
      <button type="button" onClick={() => setCount((current) => current + 1)}>+1</button>
      <a href="/">Home</a>
    </main>
  );
}
