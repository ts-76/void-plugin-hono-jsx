import { useState } from 'hono/jsx';
import { Link, useRouter, useShared, useParams, useErrors } from 'void-plugin-hono-jsx/pages';
import { useForm } from 'void-plugin-hono-jsx/form';
import type { Props } from './index.server';
export default function Page({ initialCount }: Props) {
  const [count, setCount] = useState(initialCount);
  const router = useRouter();
  const form = useForm({ name: 'Consumer' });
  return <main><h1>Clean package consumer</h1>
    <p id="initial-prop">{initialCount}</p>
    <output id="count">{count}</output>
    <button id="increment" onClick={() => setCount((value) => value + 1)}>Increment</button>
    <Link id="other" href="/other">Other page</Link>
    <button id="deferred-link" onClick={() => void router.visit('/deferred?token=spa')}>Deferred page</button>
    <button id="group-link" onClick={() => void router.visit(`/deferred-group?token=group-${import.meta.env.DEV ? 'development' : 'production'}`)}>Grouped deferred</button>
    <Link id="islands-link" href="/islands">Island page</Link>
    <p id="runtime-hooks">{router.path}:{Object.keys(useShared()).length}:{Object.keys(useParams()).length}:{Object.keys(useErrors()).length}:{form.data.name}</p>
  </main>;
}
