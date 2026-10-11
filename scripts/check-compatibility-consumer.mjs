import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export async function checkCompatibilityConsumer({ consumer, env }) {
  for (const [name, version] of [['void', '0.26.1'], ['hono', '4.13.13'], ['vite', '8.3.3']]) {
    const path = join(consumer, 'node_modules', name, 'package.json');
    const original = await readFile(path, 'utf8');
    try {
      const metadata = JSON.parse(original);
      assert.equal(metadata.version, version);
      await writeFile(path, JSON.stringify({ ...metadata, version: '999.0.0' }));
      const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: consumer, env, encoding: 'utf8' });
      assert.ok(result.status !== 0, `Unverified ${name} must fail`);
      assert.ok((result.stdout + result.stderr).includes(`install ${name}@${version}`), `Missing actionable ${name} version diagnostic`);
    } finally { await writeFile(path, original); }
  }
  console.log('Compatibility: pinned Void/Hono/Vite baseline verified; unverified package versions fail with install instructions.');
}
