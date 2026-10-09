import { useState } from 'hono/jsx';
import { Link, useRouter, useShared, useParams, useErrors } from 'void-plugin-hono-jsx/pages';
import { useForm } from 'void-plugin-hono-jsx/form';
import type { Props } from './index.server';
export default function Page({ initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const router = useRouter();
  const form = useForm({ name: 'Consumer' });
  return <main><h1>Clean package consumer</h1>
    <output id="count">{count}</output>
    <button id="increment" onClick={() => setCount((value) => value + 1)}>Increment</button>
    <Link id="other" href="/other">Other page</Link>
    <p id="runtime-hooks">{router.path}:{Object.keys(useShared()).length}:{Object.keys(useParams()).length}:{Object.keys(useErrors()).length}:{form.data.name}</p>
  </main>;
}
