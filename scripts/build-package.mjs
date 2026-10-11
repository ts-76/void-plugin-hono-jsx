import { execFileSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';

await rm('packages/hono-pages/dist', { recursive: true, force: true });
for (const target of ['plugins', 'server', 'browser']) {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `packages/hono-pages/tsconfig.${target}.json`], { stdio: 'inherit' });
}
const { name } = JSON.parse(await readFile('packages/hono-pages/package.json', 'utf8'));
// Use the same public module identity for providers and hooks in every compiled entry.
for (const target of ['server/form', 'browser/form', 'browser/client']) {
  const path = `packages/hono-pages/dist/${target}.js`;
  const source = await readFile(path, 'utf8');
  if (!source.includes("'./pages.js'")) throw new Error(`Missing Pages runtime import in ${target}`);
  await writeFile(path, source.replaceAll("'./pages.js'", JSON.stringify(name + '/pages')));
}
// The source adapter loads environment-transformed TSX; the package loads precompiled runtime entries.
await writeFile('packages/hono-pages/dist/plugins/runtime-paths.js', `import { fileURLToPath } from 'node:url';
export const pagesRuntimePath = fileURLToPath(new URL('../server/pages.js', import.meta.url));
export const clientRuntimePath = fileURLToPath(new URL('../browser/client.js', import.meta.url));
export const publicRuntimeModules = {
  ${JSON.stringify(name + '/pages')}: { server: fileURLToPath(new URL('../server/pages.js', import.meta.url)), client: fileURLToPath(new URL('../browser/pages.js', import.meta.url)) },
  ${JSON.stringify(name + '/form')}: { server: fileURLToPath(new URL('../server/form.js', import.meta.url)), client: fileURLToPath(new URL('../browser/form.js', import.meta.url)) },
};
`);
