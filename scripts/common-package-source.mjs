import assert from 'node:assert/strict';

/** Release evidence must exercise the dependency consumers will get from npm. */
export function commonPackageSource({ accepted, override, range, packLocal }) {
  if (accepted) {
    assert.ok(!override, 'Accepted release checks cannot override the published common dependency.');
    assert.match(range ?? '', /^(?:\^|~)?\d+\.\d+\.\d+$/, 'Missing public common dependency range');
    return '@ts-76/hono-markdown@' + range;
  }
  return override || packLocal();
}
