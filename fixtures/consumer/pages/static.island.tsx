import { css } from 'hono/css';
import { HonoStyles } from 'void-plugin-hono-jsx/pages';
export const layout = false;
export default function Page() {
  return <><HonoStyles /><main><h1 id="static-only" class={css`color:rgb(12,34,56);`}>Static Hono island page</h1><p>STATIC_ONLY_PAGE_SENTINEL</p></main></>;
}
