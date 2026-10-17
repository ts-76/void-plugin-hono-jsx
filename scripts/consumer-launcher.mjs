import { join } from 'node:path';

export const consumerStacks = {
  'void-1-vite': { fixture: 'consumer-void-1-vite', void: '1.1.11', vite: '8.3.4', hostVite: '8.3.4', launcher: 'vite' },
  'void-1-vp': { fixture: 'consumer-void-1-vp', void: '1.1.11', vite: 'npm:@voidzero-dev/vite-plus-core@1.3.0', vitePackageVersion: '1.3.0', hostVite: '8.3.4', launcher: 'vp' },
  baseline: { fixture: 'consumer', void: '0.26.1', vite: '8.3.3', hostVite: '8.3.3', launcher: 'vite' },
  'vite-patch': { fixture: 'consumer-vite-8.3.4', void: '0.26.1', vite: '8.3.4', hostVite: '8.3.4', launcher: 'vite' },
  'latest-vite': { fixture: 'consumer-latest-vite', void: '0.27.0', vite: '8.3.4', hostVite: '8.3.4', launcher: 'vite' },
  'scaffold-vp': { fixture: 'consumer-scaffold-vp', void: '0.27.0', vite: '8.3.4', hostVite: '8.0.16', launcher: 'vp' },
  'latest-vp': { fixture: 'consumer-latest-vp', void: '0.27.0', vite: 'npm:@voidzero-dev/vite-plus-core@1.1.0', vitePackageVersion: '1.1.0', hostVite: '8.3.3', launcher: 'vp' },
};
export function consumerStack(env = process.env) {
  const name = env.RELEASE_CONSUMER_STACK || 'baseline';
  if (!Object.hasOwn(consumerStacks, name)) throw new Error(`Unknown consumer stack: ${name}`);
  return { name, ...consumerStacks[name] };
}
export function launcherArgs(consumer, command, extra = [], env = process.env) {
  const stack = consumerStack(env);
  const entry = stack.launcher === 'vp' ? 'node_modules/vite-plus/bin/vp' : 'node_modules/vite/bin/vite.js';
  const commands = stack.launcher === 'vp' ? [command] : command === 'dev' ? [] : [command];
  return [join(consumer, entry), ...commands, ...extra];
}
