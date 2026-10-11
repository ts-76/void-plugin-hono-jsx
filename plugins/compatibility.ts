import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const supported = { void: '0.26.0', hono: '4.13.13', vite: '8.3.3' };
export function assertSupportedFrameworks() {
  const require = createRequire(import.meta.url);
  for (const [name, expected] of Object.entries(supported)) {
    let directory = dirname(require.resolve(name));
    let version: string | undefined;
    while (true) {
      const path = join(directory, 'package.json');
      if (existsSync(path)) {
        const metadata: unknown = JSON.parse(readFileSync(path, 'utf8'));
        if (typeof metadata === 'object' && metadata !== null && 'name' in metadata && metadata.name === name) {
          if (!('version' in metadata) || typeof metadata.version !== 'string') throw new Error(`Hono Pages: ${name} package version is missing.`);
          version = metadata.version;
          break;
        }
      }
      const parent = dirname(directory);
      if (parent === directory) throw new Error(`Hono Pages: cannot locate ${name} package metadata.`);
      directory = parent;
    }
    if (version !== expected) throw new Error(`Hono Pages: ${name} ${version} is unverified; install ${name}@${expected}. The adapter requires void@0.26.0, hono@4.13.13 and vite@8.3.3.`);
  }
}
