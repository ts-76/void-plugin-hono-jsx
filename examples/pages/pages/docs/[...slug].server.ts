import { defineHandler, type InferProps } from 'void';
import { HTTPException } from 'hono/http-exception';

export const loader = defineHandler((c) => {
  const slug = c.req.param('slug');
  if (slug === undefined) throw new HTTPException(404);
  return { slug };
});
export type Props = InferProps<typeof loader>;
