import { defineHandler, type InferProps } from 'void';

export const ssr = false;
export const loader = defineHandler(() => ({ initialCount: 11 }));
export const head = () => ({ link: [{ rel: 'icon', href: 'data:,' }] });
export type Props = InferProps<typeof loader>;
