import { defineHandler, type InferProps } from 'void';

export const ssr = false;
export const loader = defineHandler(() => ({ initialCount: 11 }));
export type Props = InferProps<typeof loader>;
