import { Link, useRouter } from 'void-plugin-hono-jsx/pages';
import type { InferProps } from 'void';
import type { loader } from './transitions.server';
export default function Page({ value }: InferProps<typeof loader>) {
  const router = useRouter();
  return <main><h1 id="transition-value">{value}</h1><output id="transition-hover-delay">{router._hoverDelay}</output>
    <Link id="transition-on" href="/transitions?value=on" viewTransition>Enabled</Link>
    <Link id="transition-off" href="/transitions?value=off" viewTransition={false}>Disabled</Link>
    <Link id="transition-default" href="/transitions?value=default">Global default</Link>
    <Link id="transition-slow" href="/transitions?value=slow&slow=1">Slow</Link>
    <Link id="transition-hover" href="/transitions?value=hover" prefetch>Hover</Link>
    <Link id="transition-error" href="/transitions?value=error">Error</Link>
    <button id="transition-programmatic" onClick={() => void router.visit('/transitions?value=programmatic')}>Programmatic</button>
  </main>;
}
