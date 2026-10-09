import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5174';
async function request(path, method = 'GET', name = 'Test') {
  return fetch(base + path, { method, headers: { 'X-VoidPages': 'true', Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) }, ...(method !== 'GET' ? { body: JSON.stringify({ name }) } : {}), redirect: 'manual' });
}
for (const path of ['/edit', '/named?save']) {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await request(path, method, method + ' name');
    assert.equal(response.status, 200);
    const page = await response.json();
    assert.equal(page.props.name, method === 'DELETE' ? 'Original' : method + ' name');
    assert.equal(page.errors, null);
  }
  const invalid = await (await request(path, 'POST', '')).json();
  assert.deepEqual(invalid.errors, { name: 'Name is required.' });
  assert.equal(invalid.props.name, 'Original');
}
const redirect = await request('/named?redirect', 'POST');
assert.equal(redirect.status, 302);
assert.equal(redirect.headers.get('location'), '/users/saved?redirect');
assert.equal((await request('/named?unknown', 'POST')).status, 404);
assert.equal((await request('/named?fail', 'POST')).status, 500);
if (process.argv.includes('--check-build')) {
  for (const file of await readdir('examples/pages/dist/client/assets')) {
    if (file.endsWith('.js')) assert.doesNotMatch(await readFile('examples/pages/dist/client/assets/' + file, 'utf8'), /Example action failed\.|Name is required\./);
  }
}
console.log('All mutation methods, named actions, field errors, redirect, failures and optional action bundle isolation passed: ' + base);
