import { useState } from 'hono/jsx';
import { Link, useRouter, type Deferred } from 'void-plugin-hono-jsx/pages';
import type { Props } from './deferred.server';
function Slow({ value }: { value: Deferred<string> }) {
  if (value.loading) return <p id="deferred-state">Loading slow value</p>;
  if (value.error) return <p id="deferred-state" role="alert">{value.error.message}</p>;
  return <p id="deferred-state">{value.value}</p>;
}
export default function Page({ immediate, token, slow }: Props) {
  const [count, setCount] = useState(0);
  const router = useRouter();
  return <main><h1 id="deferred-immediate">{immediate}</h1><Slow value={slow} />
    <output id="deferred-local">{count}</output><button id="deferred-local-increment" onClick={() => setCount((value) => value + 1)}>Increment page</button>
    <button id="deferred-next" onClick={() => void router.visit(`/deferred?token=${token}-next`)}>Next slow page</button>
    <Link id="deferred-away" href="/other">Leave slow page</Link>
  </main>;
}
