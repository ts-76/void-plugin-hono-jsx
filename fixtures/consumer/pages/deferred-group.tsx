import { useState } from 'hono/jsx';
import { Link, useRouter, type Deferred } from 'void-plugin-hono-jsx/pages';
import type { Props } from './deferred-group.server';
function Value({ id, value }: { id: string; value: Deferred<string> }) {
  return <output id={id}>{value.loading ? 'pending' : value.error ? value.error.message : value.value}</output>;
}
export default function Page({ token, version, left, right }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [prefetched, setPrefetched] = useState(false);
  const next = `/deferred-group?token=${token}-prefetch`;
  return <main><h1>Grouped deferred</h1><output id="group-version">{version}</output>
    <Value id="group-left" value={left} /><Value id="group-right" value={right} />
    <button id="group-increment" onClick={() => setCount(count + 1)}>{count}</button>
    <Link id="group-save" href={`/deferred-group?token=${token}`} method="post" data={{ save: true }}>Save</Link>
    <button id="group-prefetch" onClick={() => void router.prefetch(next).then(() => setPrefetched(true))}>Prefetch</button>
    <output id="group-prefetched">{String(prefetched)}</output>
    <Link id="group-visit" href={next}>Visit cached group</Link>
    <button id="group-pending" onClick={() => void router.visit(`/deferred-group?token=${token}-pending`)}>Pending group</button>
    <Link id="group-away" href="/other">Leave</Link>
  </main>;
}
