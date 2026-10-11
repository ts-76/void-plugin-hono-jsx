import { useState } from 'hono/jsx';
export default function Page({ version, message }: { version: number; message: string }) {
  const [count, setCount] = useState(version);
  return <main><h1>Local ISR consumer</h1><output id="isr-version">{version}</output>
    <p id="isr-message">{message}</p><output id="isr-count">{count}</output>
    <button id="isr-increment" onClick={() => setCount((value) => value + 1)}>Increment</button>
  </main>;
}
