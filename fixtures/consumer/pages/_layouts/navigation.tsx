import type { PropsWithChildren } from 'hono/jsx';
import { useNavigation } from 'void-plugin-hono-jsx/pages';
export default function Layout({ children }: PropsWithChildren) {
  return <section><output id="layout-navigation-state">{useNavigation().state}</output>{children}</section>;
}
