import { useState } from 'hono/jsx';

export function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  return (
    <section aria-label="カウンター">
      <p>カウント: <output id="count" aria-live="polite">{count}</output></p>
      <button id="increment" type="button" onClick={() => setCount((current) => current + 1)}>+1</button>
      <button type="button" onClick={() => setCount(initialCount)}>リセット</button>
    </section>
  );
}
