type Result = { state: 'pending' } | { state: 'resolved'; value: string } | { state: 'rejected'; message: string };
const gates = new Map<string, { result: Result; requests: number; completions: number }>();
export function status(token: string) {
  return gates.get(token) ?? { result: { state: 'pending' }, requests: 0, completions: 0 };
}
export function release(token: string, fail: boolean) {
  const gate = gates.get(token);
  if (!gate) return false;
  gate.result = fail ? { state: 'rejected', message: 'Deferred example unavailable.' } : { state: 'resolved', value: `Resolved ${token}: </script>&\u2028\u2029` };
  return true;
}
export async function wait(token: string) {
  const gate = { result: { state: 'pending' } satisfies Result, requests: 1, completions: 0 };
  const previous = gates.get(token);
  if (previous) previous.requests++;
  else gates.set(token, gate);
  const active = gates.get(token);
  if (!active) throw new Error('Missing deferred gate.');
  const deadline = Date.now() + 20000;
  while (active.result.state === 'pending') {
    if (Date.now() > deadline) throw new Error('Deferred example gate timed out.');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  active.completions++;
  if (active.result.state === 'rejected') throw new Error(active.result.message);
  return active.result.value;
}
