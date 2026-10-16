import type { PropsWithChildren } from 'hono/jsx';
export default function BrokenLayout({ children }: PropsWithChildren) {
  if (typeof window !== 'undefined') throw new Error('Transition layout render failed');
  return <section>{children}</section>;
}
