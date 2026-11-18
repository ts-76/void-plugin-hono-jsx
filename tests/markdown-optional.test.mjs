import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../packages/void-plugin-hono-jsx/src/', import.meta.url));
const specifiers = (code) =>
  [...code.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );

// Collects every package imported from an entry through the adapter's own relative imports.
function packagesReachableFrom(entry) {
  const seen = new Set();
  const packages = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of specifiers(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier));
      else packages.add(specifier);
    }
  };
  visit(resolve(src, entry));
  return packages;
}

test('entries used without Markdown do not import the optional Markdown package', () => {
  for (const entry of [
    'plugins/pages/plugin.ts',
    'runtime/index.ts',
    'runtime/pages/client.tsx',
    'runtime/pages/ssr-page.ts',
    'runtime/islands/client.ts',
    'runtime/islands/page.ts',
  ]) {
    const reached = [...packagesReachableFrom(entry)];
    assert.ok(reached.length > 0, `${entry} was not analyzed`);
    assert.deepEqual(
      reached.filter((name) => name.startsWith('@ts-76/hono-markdown')),
      [],
      entry,
    );
  }
});

test('the Markdown entries still use the shared Markdown package', () => {
  assert.ok(packagesReachableFrom('plugins/markdown/plugin.ts').has('@ts-76/hono-markdown/parser'));
  assert.ok(packagesReachableFrom('runtime/markdown/context.ts').has('@ts-76/hono-markdown'));
});
