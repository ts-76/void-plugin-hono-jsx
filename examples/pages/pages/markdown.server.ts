import { defineHandler, type InferProps } from 'void';

export const loader = defineHandler(() => ({ message: 'サーバーから読み込みました' }));
export type Props = InferProps<typeof loader>;
