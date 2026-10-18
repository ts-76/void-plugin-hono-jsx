import { defineHandler, defineHead, type InferProps } from 'void';
export const loader = defineHandler(c => {
  const nonce = crypto.randomUUID();
  // Vite development CSS has its own nonce lifecycle; enforce CSP in preview.
  if (!import.meta.env.DEV) c.header('Content-Security-Policy', `style-src 'self' 'nonce-${nonce}'`);
  return { lang: c.req.param('lang') === 'ja' ? 'ja' : 'en', page: c.req.param('page') === 'two' ? 'two' : 'one', theme: c.req.query('theme') === 'dark' ? 'dark' : 'light', nonce };
});
export type Props = InferProps<typeof loader>;
export const head = defineHead<Props>((_c, props) => ({ title: props.lang === 'ja' ? 'スタイル検証' : 'Style verification', htmlAttrs: { lang: props.lang } }));
