import { launcherArgs } from './consumer-launcher.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export async function checkCompatibilityConsumer({ consumer, env, stack }) {
  const build = () => spawnSync(process.execPath, launcherArgs(consumer, 'build', [], env), { cwd: consumer, env, encoding: 'utf8' });
  for (const [name, version] of [['void', stack.void], ['hono', '4.13.13']]) {
    const path = join(consumer, 'node_modules', name, 'package.json');
    const original = await readFile(path, 'utf8');
    try {
      assert.equal(JSON.parse(original).version, version);
      await writeFile(path, JSON.stringify({ ...JSON.parse(original), version: '999.0.0' }));
      const result = build();
      assert.notEqual(result.status, 0, `Unverified ${name} must fail`);
      const diagnostic = result.stdout + result.stderr;
      assert.ok(diagnostic.includes(`${name} 999.0.0 is unsupported`));
      assert.ok(diagnostic.includes(path), `Missing resolved ${name} metadata path`);
      assert.ok(diagnostic.includes(`Running Vite from hook context: ${stack.hostVite}`));
    } finally { await writeFile(path, original); }
  }
  const configPath = join(consumer, 'vite.config.ts');
  const originalConfig = await readFile(configPath, 'utf8');
  const vitePath = join(consumer, 'node_modules/vite/package.json');
  assert.equal(JSON.parse(await readFile(vitePath, 'utf8')).version, stack.vitePackageVersion ?? stack.vite);
  try {
    // Same real host and npm dependency; report a different host via the actual hook.
    const config = `import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoPages } from 'void-plugin-hono-jsx/plugin';
const pages = voidHonoPages();
const plugin = pages.find(p => p.name === 'void-hono:pages');
const configHook = plugin.config;
plugin.config = function(config, env) { return configHook.call({ ...this, meta: { ...this.meta, viteVersion: '9.0.0' } }, config, env); };
export default defineConfig({ plugins: [voidPlugin(), ...pages] });`;
    await writeFile(configPath, config);
    const result = build();
    assert.notEqual(result.status, 0, 'Unsupported running Vite must fail despite supported installed Vite');
    const diagnostic = result.stdout + result.stderr;
    assert.match(diagnostic, /running Vite 9\.0\.0 is unsupported/);
    assert.ok(diagnostic.includes(vitePath), 'Missing diagnostic resolved Vite package path');
    assert.match(diagnostic, /CLI\/launcher/);
  } finally { await writeFile(configPath, originalConfig); }
  console.log(`Compatibility: real host Vite ${stack.hostVite}, resolved metadata paths and rejection of a differing unsupported host verified.`);
}
