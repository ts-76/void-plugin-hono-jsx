import type { Child } from 'hono/jsx';
import { LayoutCounter } from '../../src/LayoutCounter';
export default function NamedLayout({ children }: { children: Child }) {
  return <LayoutCounter name="named" children={children} />;
}
