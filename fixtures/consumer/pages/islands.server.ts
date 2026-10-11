import { defineHandler, type InferProps } from 'void';
export const loader = defineHandler(() => ({ initialCount: 9, message: `"'&</script><img src=x onerror="globalThis.islandInjected=true">\u2028\u2029` }));
export type Props = InferProps<typeof loader>;
