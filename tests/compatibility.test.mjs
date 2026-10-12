import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertSupportedFrameworks, supportsVite, supportsFramework } from '../packages/hono-pages/src/plugins/compatibility.ts';
import { voidHonoPages } from '../packages/hono-pages/src/plugins/hono-pages.ts';

function project(version = '8.3.3') {
  const root = mkdtempSync(join(tmpdir(), 'hono-vite-identity-'));
  mkdirSync(join(root, 'node_modules/vite'), { recursive: true });
  writeFileSync(join(root, 'package.json'), '{"private":true}');
  writeFileSync(join(root, 'node_modules/vite/package.json'), JSON.stringify({name:'vite',version,main:'index.js'}));
  writeFileSync(join(root, 'node_modules/vite/index.js'), '');
  return {root, cleanup:()=>rmSync(root,{recursive:true,force:true})};
}

test('accept stable Vite 8 updates at or above the scaffold minimum, excluding prereleases', () => {
  for (const version of ['8.0.16','8.0.99','8.1.0','8.3.3','8.3.4','8.3.99','8.4.0']) assert.equal(supportsVite(version),true);
  for (const version of ['8.0.15','7.3.4','9.3.3','8.3.4-alpha.0','8.3.03','8.3.4.0',undefined]) assert.equal(supportsVite(version),false);
});

test('actual hook Vite accepts patch differences even when project resolves another supported copy', () => {
  const p=project('8.3.4'); try {
    for (const viteVersion of ['8.0.16','8.3.3','8.3.4']) assert.doesNotThrow(()=>assertSupportedFrameworks({root:p.root,viteVersion}));
  } finally {p.cleanup();}
});

test('unsupported running Vite fails despite project and adapter resolving supported npm Vite', () => {
  const p=project(); try {
    assert.throws(()=>assertSupportedFrameworks({root:p.root,viteVersion:'9.0.0'}), error=>{
      assert.match(error.message,/running Vite 9\.0\.0 is unsupported/);
      assert.ok(error.message.includes(join(p.root,'node_modules/vite/package.json')));
      assert.match(error.message,/Adapter helper Vite: 8\.3\.3; package\.json: .*package\.json/);
      assert.match(error.message,/installing project vite alone does not update the running Vite/);
      return true;
    });
  } finally {p.cleanup();}
});

test('missing host version fails closed instead of using resolved package metadata', () => {
  const p=project(); try {
    assert.throws(()=>assertSupportedFrameworks({root:p.root,viteVersion:undefined}), /running Vite unavailable is unsupported/);
  } finally {p.cleanup();}
});

test('config hook uses its own meta version and identifies its configured project root', () => {
  const p=project('8.3.4'); try {
    const plugin=voidHonoPages().find(p=>p.name==='void-hono:pages');
    assert.throws(()=>plugin.config.call({meta:{viteVersion:'9.0.0'}},{root:p.root},{}), error=>error.message.includes('running Vite 9.0.0') && error.message.includes(join(p.root,'node_modules/vite/package.json')));
    assert.ok(plugin.config.call({meta:{viteVersion:'8.3.4'}},{root:p.root},{}).resolve);
  } finally {p.cleanup();}
});

test('Void pre-1.0 minors and Hono major boundaries follow the declared peer policy', () => {
  for (const version of ['0.26.1', '0.26.2', '0.27.0', '0.27.99']) assert.equal(supportsFramework('void',version),true);
  for (const version of ['0.26.0', '0.28.0', '1.0.0', '0.27.1-beta.0']) assert.equal(supportsFramework('void',version),false);
  for (const version of ['4.13.13', '4.13.14', '4.14.0']) assert.equal(supportsFramework('hono',version),true);
  for (const version of ['4.13.12', '5.0.0', '4.14.0-beta.0']) assert.equal(supportsFramework('hono',version),false);
});
