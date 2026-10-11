import { useState, type Child } from 'hono/jsx';
import { useShared, useParams } from '../../../packages/hono-pages/src/runtime/pages';

export function LayoutCounter({ name, children }: { name: string; children: Child }) {
  const [count, setCount] = useState(0);
  const shared = useShared();
  const params = useParams();
  return <section data-layout={name}>
    <p>{name}: <output id={`${name}-count`}>{count}</output></p>
    <button id={`${name}-increment`} onClick={() => setCount((value) => value + 1)}>Increment {name}</button>
    <p data-shared={name}>{JSON.stringify(shared)}</p>
    <p data-params={name}>{JSON.stringify(params)}</p>
    {children}
  </section>;
}
