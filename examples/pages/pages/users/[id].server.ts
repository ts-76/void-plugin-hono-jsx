import { defineHandler, type InferProps } from 'void';
import { HTTPException } from 'hono/http-exception';

const serverOnlyMarker = 'HonoPagesServerOnlySentinel_93ac62';

export const loader = defineHandler(async (c) => {
  if (c.req.query('fail') === '1') throw new Error(serverOnlyMarker);
  if (c.req.query('delay') === '700') await new Promise((resolve) => setTimeout(resolve, 700));
  const id = c.req.param('id');
  if (id === undefined) throw new HTTPException(404);
  return { id };
});

export type Props = InferProps<typeof loader>;
