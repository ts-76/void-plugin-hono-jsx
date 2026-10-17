import { Link, useRouter } from 'void-plugin-hono-jsx/pages';
import { useLayoutEffect, useState } from 'hono/jsx';
import type { VoidRouter } from 'void/pages-client';
import '../components/transition.css';
import type { InferProps } from 'void';
import type { loader } from './transitions.server';
declare global { interface Window { transitionRouter: VoidRouter } }
export default function Page({ value }: InferProps<typeof loader>) {
  const router = useRouter();
  const [local, setLocal] = useState(0);
  useLayoutEffect(() => { window.transitionRouter = router; }, [router]);
  if (typeof window !== 'undefined' && value === 'render-error') throw new Error('Transition component render failed');
  return <main><button id="transition-local" onClick={() => setLocal(local + 1)}>{local}</button><h1 id="transition-value">{value}</h1><output id="transition-hover-delay">{router._hoverDelay}</output>
    <p id="transition-cascade" class="transition-cascade">Stylesheet order</p>
    <Link id="transition-on" href="/transitions?value=on" viewTransition>Enabled</Link>
    <Link id="transition-off" href="/transitions?value=off" viewTransition={false}>Disabled</Link>
    <Link id="transition-default" href="/transitions?value=default">Global default</Link>
    <Link id="transition-slow" href="/transitions?value=slow&slow=1">Slow</Link>
    <Link id="transition-hover" href="/transitions?value=hover" prefetch>Hover</Link>
    <Link id="transition-error" href="/transitions?value=error">Error</Link>
    <button id="transition-programmatic" onClick={() => void router.visit('/transitions?value=programmatic')}>Programmatic</button>
  </main>;
}
