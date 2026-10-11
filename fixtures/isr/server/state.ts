export const state = { version: 1, fail: false, renders: {} as Record<string, number> };
export function props(path: string) {
  state.renders[path] = (state.renders[path] ?? 0) + 1;
  if (state.fail) throw new Error('Controlled ISR regeneration failure');
  return { version: state.version, message: '</script><script>window.isrInjected=1</script>&\u2028\u2029' };
}
