import type { Child } from 'hono/jsx';
import { LayoutCounter } from '../src/LayoutCounter';
export default function RootLayout({ children }: { children: Child }) {
  return <LayoutCounter name="root" children={children} />;
}
