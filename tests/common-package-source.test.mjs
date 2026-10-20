import test from 'node:test';
import assert from 'node:assert/strict';
import { commonPackageSource } from '../scripts/common-package-source.mjs';

test('accepted artifacts select the public common package and cannot substitute local bytes', () => {
  const packLocal=()=>{throw new Error('must not pack local source')};
  assert.equal(commonPackageSource({accepted:true,range:'^0.1.0',packLocal}), '@ts-76/hono-markdown@^0.1.0');
  assert.throws(()=>commonPackageSource({accepted:true,range:'^0.1.0',override:'/tmp/common.tgz',packLocal}), /cannot override/);
  assert.throws(()=>commonPackageSource({accepted:true,range:'file:local',packLocal}), /public common dependency range/);
});
test('development checks may pack or select an explicit local candidate', () => {
  assert.equal(commonPackageSource({accepted:false,packLocal:()=>'/tmp/packed.tgz'}),'/tmp/packed.tgz');
  assert.equal(commonPackageSource({accepted:false,override:'/tmp/explicit.tgz',packLocal:()=>{throw new Error('unexpected')}}),'/tmp/explicit.tgz');
});
