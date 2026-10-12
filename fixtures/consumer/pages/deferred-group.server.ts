import { defineHandler, defer, type InferProps, type Deferred } from 'void';
import { wait } from '../server/deferred-gates';
let version = 0;
export const loader = defineHandler((c) => {
  const token = c.req.query('token') ?? 'group';
  const snapshot = version;
  const resolve = async () => {
    const value = await wait(token);
    return { left: `${value}:left:${snapshot}`, right: `${value}:right:${snapshot}` };
  };
  // Void projects each group result by prop key at runtime; its defer<T>
  // declaration describes the whole resolver result, not these projections.
  return { token, version: snapshot,
    left: defer('bundle', resolve) as unknown as Deferred<string>,
    right: defer('bundle', resolve) as unknown as Deferred<string> };
});
export const action = defineHandler(async (c) => { await c.req.json(); version++; });
export type Props = InferProps<typeof loader>;
