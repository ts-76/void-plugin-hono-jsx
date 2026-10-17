import type { NavigationFallbackProps } from 'void-plugin-hono-jsx/pages';
export default function Fallback({ navigation }: NavigationFallbackProps) {
  if (navigation.location?.searchParams.get('value') === 'fallback-render-error') throw new Error('Fallback component failed');
  return <p id="common-navigation-fallback">Loading {navigation.location?.pathname}</p>;
}
