import './build-markdown.mjs';
import { execFileSync } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { rewritePagesImport } from './rewrite-package-import.mjs';

await rm('packages/void-plugin-hono-jsx/dist', { recursive: true, force: true });
for (const target of ['plugins', 'server', 'browser']) {
  execFileSync(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '-p',
      `packages/void-plugin-hono-jsx/tsconfig.${target}.json`,
    ],
    { stdio: 'inherit' },
  );
}
// release-please manages one canonical changelog; pack its exact contents.
await writeFile('packages/void-plugin-hono-jsx/CHANGELOG.md', await readFile('CHANGELOG.md'));
const { name } = JSON.parse(await readFile('packages/void-plugin-hono-jsx/package.json', 'utf8'));
// Keep provider identity and compose the edit map with the compiler map.
for (const target of [
  'server/pages/form',
  'browser/pages/form',
  'browser/pages/client',
  'server/pages/ssr-page',
]) {
  const file = `packages/void-plugin-hono-jsx/dist/${target}.js`;
  const source = await readFile(file, 'utf8');
  const originalMap = JSON.parse(await readFile(file + '.map', 'utf8'));
  const edited = rewritePagesImport(source, originalMap, name);
  await writeFile(file, edited.code);
  await writeFile(file + '.map', JSON.stringify(edited.map) + '\n');
}

// Preserve the existing public theme as a compatibility snapshot.
// Common themes evolve independently; do not overwrite these debug sources.
await cp('packages/void-plugin-hono-jsx/src/theme', 'packages/void-plugin-hono-jsx/dist/theme', {
  recursive: true,
});
