import { useState } from 'hono/jsx';
export default function Counter() { const [count, setCount] = useState(1); return <button id="island-counter" onClick={() => setCount(count + 1)}>Island {count}</button>; }
