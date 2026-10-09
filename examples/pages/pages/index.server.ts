import { defineHandler, type InferProps } from 'void';

export const loader = defineHandler(() => ({
  initialCount: 7,
  message: '</script><script>globalThis.__honoPagesInjected = true</script>&\u2028\u2029',
}));

export type Props = InferProps<typeof loader>;
