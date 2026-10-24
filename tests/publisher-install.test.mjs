import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publisherSnapshot } from '../scripts/release/publisher.mjs';

const extractor = fileURLToPath(new URL('../scripts/release/extract-publisher.py', import.meta.url));
const archiveScript = `import tarfile,io,json,sys
with tarfile.open(sys.argv[1],'w:gz') as tar:
 for entry in json.loads(sys.argv[2]):
  item=tarfile.TarInfo(entry['path']);data=entry.get('content','').encode()
  if entry.get('link'):item.type=tarfile.SYMTYPE;item.linkname=entry['link']
  else:item.size=len(data)
  tar.addfile(item,io.BytesIO(data) if not entry.get('link') else None)
`;
function extract(entries) {
  const root = mkdtempSync(path.join(tmpdir(), 'publisher-extract-'));
  const archive = path.join(root, 'input.tgz');
  execFileSync('python3', ['-c', archiveScript, archive, JSON.stringify(entries)]);
  try {
    execFileSync('python3', [extractor, archive, path.join(root, 'output')], { stdio: 'pipe' });
    return readFileSync(path.join(root, 'output/file.js'), 'utf8');
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('publisher extraction accepts identical canonical bytes and rejects ambiguous or escaping content', () => {
  assert.equal(extract([{ path: 'package/./file.js', content: 'verified' }, { path: 'package/file.js', content: 'verified' }]), 'verified');
  for (const entries of [
    [{ path: 'package/../escape.js' }], [{ path: '/package/file.js' }],
    [{ path: 'package/file.js', link: '../../outside' }],
    [{ path: 'package/file.js', content: 'first' }, { path: 'package/./file.js', content: 'different' }],
    [{ path: 'package/file.js' }, { path: 'another/file.js' }],
  ]) assert.throws(() => extract(entries));
});
test('the full publisher snapshot detects changed/additional bytes and rejects filesystem links', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'publisher-snapshot-'));
  try {
    writeFileSync(path.join(root, 'package.json'), '{"name":"npm","version":"11.21.1"}');
    mkdirSync(path.join(root, 'lib'));writeFileSync(path.join(root, 'lib/code.js'), 'original');
    const original = publisherSnapshot(root);
    writeFileSync(path.join(root, 'lib/code.js'), 'changed');
    assert.notEqual(publisherSnapshot(root).filesSha256, original.filesSha256);
    writeFileSync(path.join(root, 'lib/extra.js'), 'unexpected');
    assert.notEqual(publisherSnapshot(root).filesSha256, original.filesSha256);
    symlinkSync(path.join(root, 'lib/code.js'), path.join(root, 'link.js'));
    assert.throws(() => publisherSnapshot(root), /non-regular/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
