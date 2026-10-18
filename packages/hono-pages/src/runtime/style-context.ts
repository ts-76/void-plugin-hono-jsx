import { createContext, useContext } from 'hono/jsx';

export const StyleContext = createContext<((nonce: string | undefined) => void) | null>(null);

/** Sets the document's CSP style nonce during SSR; renders no node inside #app. */
export function HonoStyles({ nonce }: { nonce?: string }) {
  useContext(StyleContext)?.(nonce);
  return null;
}
