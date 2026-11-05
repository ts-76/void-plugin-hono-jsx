import './build-markdown.mjs';
import { execFileSync } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';

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

// Preserve the existing public theme as a compatibility snapshot.
// Common themes evolve independently; do not overwrite these debug sources.
await cp('packages/void-plugin-hono-jsx/src/theme', 'packages/void-plugin-hono-jsx/dist/theme', {
  recursive: true,
});
