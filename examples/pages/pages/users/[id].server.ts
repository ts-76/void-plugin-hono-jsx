import { defineHandler, type InferProps } from 'void';
import { HTTPException } from 'hono/http-exception';

const serverOnlyMarker = 'HonoPagesServerOnlySentinel_93ac62';

export const loader = defineHandler((c) => {
  if (c.req.query('fail') === '1') throw new Error(serverOnlyMarker);
  const id = c.req.param('id');
  if (id === undefined) throw new HTTPException(404);
  return { id };
});

export type Props = InferProps<typeof loader>;
