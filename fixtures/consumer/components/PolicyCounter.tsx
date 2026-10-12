import { useState } from 'hono/jsx';
export default function Counter({ id }: { id: string }) {
  const [count, setCount] = useState(0);
  return <div><output id={id + '-count'}>{count}</output><button id={id + '-increment'} onClick={() => setCount(count + 1)}>Increment</button></div>;
}
