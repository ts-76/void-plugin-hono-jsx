import { defineHandler, defer, type InferProps } from 'void';
import { wait } from '../server/deferred-gates';
export const loader = defineHandler((c) => {
  const token = c.req.query('token') ?? 'default';
  return { immediate: `Immediate ${token}`, token, slow: defer(() => wait(token)) };
});
export type Props = InferProps<typeof loader>;
