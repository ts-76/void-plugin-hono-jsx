import { useState } from 'hono/jsx';
import { css } from 'hono/css';
export default function Counter({ initialCount, message }: { initialCount: number; message: string }) {
  const [count, setCount] = useState(initialCount);
  return <section><p id="island-message">{message}</p>
    <output id="island-count" class={css`color:${count === initialCount ? 'rgb(12,34,56)' : 'rgb(65,43,21)'};`}>{count}</output>
    <button id="island-increment" onClick={() => setCount((value) => value + 1)}>Increment island</button>
  </section>;
}
