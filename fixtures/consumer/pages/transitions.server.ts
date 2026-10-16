import { defineHandler, defineHead } from 'void';
export const loader = defineHandler(async (c) => {
  if (c.req.query('slow')) await new Promise(resolve => setTimeout(resolve, 400));
  return { value: c.req.query('value') ?? 'initial' };
});
export const head = defineHead((_c, props) => ({ title: `Transition ${props.value}`, meta: [{ name: 'transition-value', content: String(props.value) }], link: [{ rel: 'canonical', href: `/transitions?value=${props.value}` }, { rel: 'stylesheet', href: 'data:text/css,.transition-cascade%7Bcolor:rgb(255,0,0)%7D' }] }));
