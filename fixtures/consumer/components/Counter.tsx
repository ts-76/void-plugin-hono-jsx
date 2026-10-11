import { useState } from 'hono/jsx';
export default function Counter({ initialCount, message }: { initialCount: number; message: string }) {
  const [count, setCount] = useState(initialCount);
  return <section><p id="island-message">{message}</p>
    <output id="island-count">{count}</output>
    <button id="island-increment" onClick={() => setCount((value) => value + 1)}>Increment island</button>
  </section>;
}
