import { Navigation } from '../src/Navigation';
import { useState } from 'hono/jsx';
import type { Props } from './index.server';
import './style.css';

export default function Page({ initialCount, message }: Props) {
  const [count, setCount] = useState(initialCount);
  return (
    <main>
      <Navigation />
      <h1>Void Pages × Hono JSX</h1>
      <p id="loader-marker">Server loader initial count: {initialCount}</p>
      <p id="serialized-message">{message}</p>
      <section aria-label="Counter">
        <p>Count: <output id="count" aria-live="polite">{count}</output></p>
        <button type="button" onClick={() => setCount((value) => value + 1)}>+1</button>
        <button type="button" onClick={() => setCount(initialCount)}>Reset</button>
      </section>
      <p>Reloading resets the counter to the loader value.</p>
    </main>
  );
}
