import Counter from '../components/Counter' with { island: 'load' };
import type { Props } from './islands.server';
export const layout = false;
export default function Page({ initialCount, message }: Props) {
  return <main><h1>Hono island page</h1><p id="static-island-content">STATIC_ISLAND_PAGE_SENTINEL</p><Counter initialCount={initialCount} message={message} /></main>;
}
