import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { gzipSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { releaseFixture } from './release-fixture.mjs';
import { inspectArtifact, inspectTarball, inspectTarballContents } from '../scripts/release/gate.mjs';

function entry(name, content = '', type = '0', link = '') {
  const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const header = Buffer.alloc(512);
  const text = (value, offset, length) => header.write(value, offset, length, 'utf8');
  const octal = (value, offset, length) => text(value.toString(8).padStart(length - 1, '0') + '\0', offset, length);
  text(name, 0, 100); octal(0o644, 100, 8); octal(0, 108, 8); octal(0, 116, 8);
  octal(data.length, 124, 12); octal(0, 136, 12); header.fill(32, 148, 156);
  text(type, 156, 1); text(link, 157, 100); text('ustar\0', 257, 6); text('00', 263, 2);
  const checksum = header.reduce((sum, value) => sum + value, 0);
  text(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)]);
}
const archive = (...entries) => gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
const repack = (f, changes = {}, order = f.evidence.files) => archive(...order.map(file => entry('package/' + file, changes[file] ?? fs.readFileSync(path.join(f.root, 'candidate/package', file)))));

test('inspection uses three tar processes and one compressed snapshot, reusing every file in the gate', () => {
  const f = releaseFixture(), original = cp.execFileSync;
  let calls = 0, snapshot;
  try {
    cp.execFileSync = function(command, args, options) {
      if (command === 'tar') {
        calls++; snapshot ??= options.input;
        assert.equal(options.input, snapshot, 'all passes must see the same compressed Buffer');
        assert.ok(args.includes('-')); assert.ok(args.includes('--ignore-zeros'));
      }
      return original.call(this, command, args, options);
    };
    syncBuiltinESMExports();
    for (let i = 0; i < 3; i++) { snapshot = undefined; inspectArtifact(f.options); }
    assert.equal(calls, 9);
  } finally { cp.execFileSync = original; syncBuiltinESMExports(); f.cleanup(); }
});

test('the content map preserves UTF-8 bytes, empty files and archive order', () => {
  const f = releaseFixture();
  try {
    const order = ['README.md', 'LICENSE', ...f.evidence.files.filter(file => !['README.md', 'LICENSE'].includes(file))];
    fs.writeFileSync(f.tarball, repack(f, { 'README.md': '日本語\n', LICENSE: '' }, order));
    const result = inspectTarballContents(f.tarball);
    assert.deepEqual(result.files, order);
    assert.equal(result.contents.get('README.md'), '日本語\n'); assert.equal(result.contents.get('LICENSE'), '');
    assert.equal(JSON.parse(result.contents.get('package.json')).name, f.pkg.name);
  } finally { f.cleanup(); }
});

for (const name of ['package/../escape.js', '/package/package.json', './package/package.json', ' package/package.json', 'package/package.json ', 'package/package.json\npackage/README.md']) {
  test('unsafe or ambiguous archive path is rejected: ' + JSON.stringify(name), () => {
    const f = releaseFixture();
    try { fs.writeFileSync(f.tarball, archive(entry(name, '{}'))); assert.throws(() => inspectTarball(f.tarball)); }
    finally { f.cleanup(); }
  });
}

for (const [type, label] of [['1','hardlink'], ['2','symlink'], ['3','device'], ['5','directory'], ['6','fifo']]) {
  test('non-regular archive entry is rejected without filesystem extraction: ' + label, () => {
    const f = releaseFixture();
    try { fs.writeFileSync(f.tarball, archive(entry('package/src/runtime/link.ts', '', type, '../outside'))); assert.throws(() => inspectTarball(f.tarball), /regular files/); }
    finally { f.cleanup(); }
  });
}

test('duplicate paths and hidden concatenated archives cannot bypass the file allowlist', () => {
  const f = releaseFixture();
  try {
    fs.writeFileSync(f.tarball, archive(entry('package/package.json', '{}'), entry('package/package.json', '{}')));
    assert.throws(() => inspectTarball(f.tarball), /Duplicate archive entry/);
    const valid = archive(entry('package/package.json', '{}'));
    const hidden = archive(entry('package/unexpected.txt', 'hidden'));
    for (const bytes of [Buffer.concat([valid, hidden]), gzipSync(Buffer.concat([gunzipSync(valid), gunzipSync(hidden)]))]) {
      fs.writeFileSync(f.tarball, bytes);
      assert.throws(() => inspectTarball(f.tarball), /Unexpected packed file/);
    }
  } finally { f.cleanup(); }
});

test('declared per-file and aggregate sizes are bounded before content extraction', () => {
  const f = releaseFixture();
  try {
    fs.writeFileSync(f.tarball, archive(entry('package/src/runtime/large.ts', Buffer.alloc(1024 * 1024 + 1))));
    assert.throws(() => inspectTarball(f.tarball), /size limit/);
    fs.writeFileSync(f.tarball, archive(...Array.from({ length: 9 }, (_, i) => entry('package/src/runtime/large' + i + '.ts', Buffer.alloc(1024 * 1024)))));
    assert.throws(() => inspectTarball(f.tarball), /size limit/);
  } finally { f.cleanup(); }
});

test('changing the file during inspection cannot mix snapshots or produce accepted evidence', () => {
  const f = releaseFixture(), original = cp.execFileSync;
  let changed = false;
  try {
    cp.execFileSync = function(command, args, options) {
      const output = original.call(this, command, args, options);
      if (command === 'tar' && !changed) { changed = true; fs.appendFileSync(f.tarball, 'changed'); }
      return output;
    }; syncBuiltinESMExports();
    assert.throws(() => inspectArtifact(f.options), /Tarball changed during inspection/);
    assert.throws(() => inspectArtifact(f.options), /Tarball changed/);
  } finally { cp.execFileSync = original; syncBuiltinESMExports(); f.cleanup(); }
});

test('maps, lifecycle/dependency checks and original-source comparison remain enforced', () => {
  const f = releaseFixture();
  try {
    fs.writeFileSync(path.join(f.pkgRoot, 'src/plugins/plugin.ts'), 'export const changed = 2;');
    assert.throws(() => inspectArtifact(f.options), /Packaged source changed/);
    for (const pkg of [{ scripts: { postinstall: 'node unexpected.js' } }, { dependencies: { unexpected: '1.0.0' } }]) {
      const base = JSON.parse(fs.readFileSync(path.join(f.root, 'candidate/package/package.json'), 'utf8'));
      fs.writeFileSync(f.tarball, repack(f, { 'package.json': JSON.stringify({ ...base, ...pkg }) }));
      assert.throws(() => inspectTarball(f.tarball), /lifecycle scripts|peer dependencies/);
    }
    fs.writeFileSync(f.tarball, repack(f, {}, f.evidence.files.filter(file => file !== 'dist/plugin.js.map')));
    assert.throws(() => inspectTarball(f.tarball), /map/i);
  } finally { f.cleanup(); }
});
