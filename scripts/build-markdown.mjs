import { execFileSync } from 'node:child_process';
import { rm, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const common = join(root, 'packages/hono-markdown');
await rm(join(common, 'dist'), { recursive: true, force: true });
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(common, 'tsconfig.json')], { cwd: root, stdio: 'inherit' });
await cp(join(common, 'src/theme'), join(common, 'dist/theme'), { recursive: true });
