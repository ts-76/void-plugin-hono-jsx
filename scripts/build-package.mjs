import { execFileSync } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { rewritePagesImport } from './rewrite-package-import.mjs';

await rm('packages/hono-pages/dist', { recursive: true, force: true });
for (const target of ['plugins', 'server', 'browser']) {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `packages/hono-pages/tsconfig.${target}.json`], { stdio: 'inherit' });
}
// release-please manages one canonical changelog; pack its exact contents.
await writeFile('packages/hono-pages/CHANGELOG.md', await readFile('CHANGELOG.md'));
const { name } = JSON.parse(await readFile('packages/hono-pages/package.json', 'utf8'));
// Keep provider identity and compose the edit map with the compiler map.
for (const target of ['server/form', 'browser/form', 'browser/client']) {
  const file = `packages/hono-pages/dist/${target}.js`;
  const source = await readFile(file, 'utf8');
  const originalMap = JSON.parse(await readFile(file + '.map', 'utf8'));
  const edited = rewritePagesImport(source, originalMap, name);
  await writeFile(file, edited.code);
  await writeFile(file + '.map', JSON.stringify(edited.map) + '\n');
}

// Public theme entries mirror @void/md; keep original CSS in the debug source.
await cp('packages/hono-pages/src/theme', 'packages/hono-pages/dist/theme', { recursive: true });
