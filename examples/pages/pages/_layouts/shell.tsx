import type { Child } from 'hono/jsx';
import { LayoutCounter } from '../../src/LayoutCounter';
import { useShared } from '../../../../packages/void-plugin-hono-jsx/src/runtime/pages/api';
import { AppShell } from '../../src/AppShell';
export default function NamedLayout({ children }: { children: Child }) {
  const content = <LayoutCounter name="named" children={children} />;
  return useShared().path === '/layouts/exclusive' ? <AppShell>{content}</AppShell> : content;
}
