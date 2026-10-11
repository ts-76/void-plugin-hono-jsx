import { Link } from '../../../packages/hono-pages/src/runtime/pages';
import { RoutePage } from './RoutePage';
export function LayoutPage({ label }: { label: string }) {
  return <><nav className="layout-navigation" aria-label="Layouts">
    {['one', 'two', 'named', 'exclusive', 'bare'].map((name) => <Link id={`layout-${name}`} href={`/layouts/${name}`}>{name}</Link>)}
  </nav><RoutePage label={label} value={label} /></>;
}
