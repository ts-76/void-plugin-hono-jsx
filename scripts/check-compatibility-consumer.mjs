import { launcherArgs } from './consumer-launcher.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Versions outside peerDependencies are reported as warnings; the build still runs.
export async function checkCompatibilityConsumer({ consumer, env, stack }) {
  const build = () =>
    spawnSync(process.execPath, launcherArgs(consumer, 'build', [], env), {
      cwd: consumer,
      env,
      encoding: 'utf8',
    });
  for (const [name, version] of [
    ['void', stack.void],
    ['hono', '4.13.16'],
  ]) {
    const path = join(consumer, 'node_modules', name, 'package.json');
    const original = await readFile(path, 'utf8');
    try {
      assert.equal(JSON.parse(original).version, version);
      await writeFile(path, JSON.stringify({ ...JSON.parse(original), version: '999.0.0' }));
      const result = build();
      const output = result.stdout + result.stderr;
      assert.equal(result.status, 0, `Unverified ${name} must only warn:\n${output}`);
      assert.ok(output.includes(`${name} 999.0.0 is outside the supported range`), output);
    } finally {
      await writeFile(path, original);
    }
  }
  const configPath = join(consumer, 'vite.config.ts');
  const originalConfig = await readFile(configPath, 'utf8');
  try {
    // Same real host and npm dependency; report a different host via the actual hook.
    const config = `import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
import { voidHonoJsx } from 'void-plugin-hono-jsx/plugin';
const pages = voidHonoJsx();
const plugin = pages.find(p => p.name === 'void-hono:pages');
const handler = plugin.configResolved.handler;
plugin.configResolved.handler = function(config) { return handler.call({ ...this, meta: { ...this.meta, viteVersion: '9.0.0' } }, config); };
export default defineConfig({ plugins: [voidPlugin(), ...pages] });`;
    await writeFile(configPath, config);
    const result = build();
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, `Unsupported running Vite must only warn:\n${output}`);
    assert.match(output, /running Vite 9\.0\.0 is outside the supported range/);
    assert.match(output, /launcher/);
  } finally {
    await writeFile(configPath, originalConfig);
  }
  console.log(
    `Compatibility: real host Vite ${stack.hostVite}; unverified Void, Hono and running Vite versions warn without failing the build.`,
  );
}
