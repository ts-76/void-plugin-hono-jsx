import { Link, useRouter } from '../../../packages/hono-pages/src/runtime/pages';

export function Navigation() {
  const router = useRouter();
  return <nav aria-label="Pages">
    <Link href="/" id="nav-home">Home</Link>{' '}
    <Link href="/users/alice?tab=profile" id="nav-alice">Alice</Link>{' '}
    <Link href="/users/bob" id="nav-bob">Bob</Link>{' '}
    <Link href="/users/slow?delay=700" id="nav-slow">Slow page</Link>{' '}
    <Link href="/users/failed?fail=1" id="nav-failed">Failed page</Link>{' '}
    <Link href="#route-value" id="nav-hash">Jump to value</Link>{' '}
    <Link href="/browser" id="nav-browser">Browser page</Link>{' '}
    <Link href="/about" reloadDocument id="nav-reload">Reload document</Link>{' '}
    <Link href="https://example.com" id="nav-external">External</Link>{' '}
    <Link href="/about" download id="nav-download">Download</Link>{' '}
    <button type="button" id="nav-refresh" onClick={() => void router.refresh()}>Refresh page</button>
  </nav>;
}
