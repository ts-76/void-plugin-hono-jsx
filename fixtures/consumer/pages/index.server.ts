import { defineHandler, type InferProps } from 'void';
export const loader = defineHandler(() => ({ initialCount: 5 }));
export type Props = InferProps<typeof loader>;
