import { defineHandler, defineHead, type InferProps } from 'void';
export const loader = defineHandler((c) => ({ id: c.req.param('id') ?? 'one', title: c.req.query('title') ?? c.req.param('id') ?? 'one' }));
export type Props = InferProps<typeof loader>;
export const head = defineHead<Props>((_c, props) => ({
  title: props.title,
  meta: [{ name: 'description', content: props.title }, { name: `page-${props.id}`, content: props.id }, { property: 'og:title', content: props.title }],
  link: [{ rel: 'canonical', href: `/head/${props.id}` }],
  script: [{ id: 'page-data', type: 'application/ld+json', innerHTML: JSON.stringify({ name: props.title }).replaceAll('<', '\\u003c') }, { id: 'page-script', innerHTML: 'window.pageHeadExecutions=(window.pageHeadExecutions||0)+1;' }],
  htmlAttrs: { 'data-level': 'page', [`data-page-${props.id}`]: props.title },
  bodyAttrs: { 'data-level': 'page', [`data-page-${props.id}`]: props.title },
}));
