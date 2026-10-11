import type { Child } from 'hono/jsx';
import { LayoutCounter } from '../src/LayoutCounter';
import { AppShell } from '../src/AppShell';
export default function RootLayout({ children }: { children: Child }) {
  return <AppShell><LayoutCounter name="root" children={children} /></AppShell>;
}
