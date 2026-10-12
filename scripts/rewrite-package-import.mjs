import assert from 'node:assert/strict';
import MagicString from 'magic-string';
import remapping from '@jridgewell/remapping';

export function rewritePagesImport(code, originalMap, packageName) {
  const original = "'./pages.js'";
  const start = code.indexOf(original);
  assert.ok(start >= 0 && code.indexOf(original, start + original.length) < 0, 'Expected one Pages runtime import');
  const edited = new MagicString(code);
  edited.overwrite(start, start + original.length, JSON.stringify(packageName + '/pages'));
  const editMap = edited.generateMap({ source: originalMap.file, file: originalMap.file, hires: true });
  const map = remapping([editMap, originalMap], () => null);
  return { code: edited.toString(), map };
}
