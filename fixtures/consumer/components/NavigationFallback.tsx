import type { NavigationFallbackProps } from 'void-plugin-hono-jsx/pages';
export default function Fallback({ navigation }: NavigationFallbackProps) {
  return <p id="common-navigation-fallback">Loading {navigation.location?.pathname}</p>;
}
