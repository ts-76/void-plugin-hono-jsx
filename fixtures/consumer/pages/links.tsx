import { useState } from 'hono/jsx';
import { Link } from 'void-plugin-hono-jsx/pages';
export default function Links({ search, tags }: { search: string; tags: string[] }) {
  const [count, setCount] = useState(0);
  return <main style="min-height: 3000px"><h1 id="links-heading">Links</h1>
    <output id="link-value">{search}:{tags.join(',')}</output>
    <output id="link-count">{count}</output><button id="link-increment" onClick={() => setCount(count + 1)}>Increment</button>
    <Link id="query-link" href="/links?keep=1" data={{ value: 'query', tag: ['one', 'two'], omitted: null }} preserveScroll>Query</Link>
    <Link id="state-link" href="/links" data={{ value: 'kept' }} preserveState preserveScroll>Keep state</Link>
    <Link id="cancel-link" href="/other" onNavigate={(event) => event.preventDefault()}>Cancel</Link>
    <Link id="replace-link" href="/links" data={{ value: 'replaced' }} replace>Replace</Link>
    <Link id="relative-link" href="?value=relative">Relative query</Link>
    {(['post', 'put', 'patch', 'delete'] as const).map((method) => <Link id={'mutation-' + method} href="/links?save" method={method} data={{ value: 'saved' }}>{method}</Link>)}
    <Link id="fail-link" href="/links?fail" method="post" data={{ value: '' }}>Failure</Link>
    <Link id="prefetch-link" href="/links?value=hover" prefetch cacheFor="1m">Hover</Link>
    <Link id="click-prefetch" href="/links?value=click" prefetch="click">Click</Link>
    <Link id="mount-prefetch" href="/links?value=mount" prefetch="mount">Mount</Link>
    <Link id="visible-prefetch" href="/links?value=visible" prefetch="visible">Visible</Link>
  </main>;
}
