import type { Child } from 'hono/jsx';
import { LayoutCounter } from '../../src/LayoutCounter';
export default function NestedLayout({ children }: { children: Child }) {
  return <LayoutCounter name="nested" children={children} />;
}
