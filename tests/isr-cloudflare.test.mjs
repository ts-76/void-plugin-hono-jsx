import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { acceptsControlKey } from '../fixtures/isr-cloudflare/server/control-auth.ts';

const key = randomBytes(32).toString('base64url');
const digest = createHash('sha256').update(key).digest('hex');

test('ISR fixture control accepts only the matching bearer verifier', async () => {
  assert.equal(await acceptsControlKey(`Bearer ${key}`, digest), true);
  for (const header of [undefined, '', key, `Basic ${key}`, `Bearer ${key}-wrong`, `Bearer ${'x'.repeat(160)}`]) {
    assert.equal(await acceptsControlKey(header, digest), false);
  }
  for (const invalid of ['', 'not-a-digest', '0'.repeat(63), '0'.repeat(65), 'g'.repeat(64)]) {
    assert.equal(await acceptsControlKey(`Bearer ${key}`, invalid), false);
  }
});
