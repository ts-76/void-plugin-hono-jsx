import { defineHandler, defineHead } from 'void';
export const loader = defineHandler(c => ({ message: `Loader ${c.req.query('name') ?? 'visitor'}` }));
export const head = defineHead((_c, props) => ({ title: `Dynamic ${props.message}` }));
