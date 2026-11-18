import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  satisfies,
  unsupportedVersions,
  warnUnsupportedVersions,
} from '../packages/void-plugin-hono-jsx/src/plugins/shared/compatibility.ts';
import { voidHonoJsx } from '../packages/void-plugin-hono-jsx/src/plugins/pages/plugin.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../packages/void-plugin-hono-jsx/package.json', import.meta.url), 'utf8'),
);
const supported = { void: '1.10.0', hono: '4.13.16' };
const installed = (versions) => (name) => versions[name];

test('ranges use the package.json comparator forms and reject prereleases or malformed versions', () => {
  for (const version of ['8.0.16', '8.3.5', '8.99.0'])
    assert.ok(satisfies(version, '>=8.0.16 <9.0.0'));
  for (const version of ['8.0.15', '9.0.0', '8.3.5-beta.0', '8.3.05', '8.3', undefined])
    assert.equal(satisfies(version, '>=8.0.16 <9.0.0'), false);
  assert.ok(satisfies('0.3.4', '^0.3.0'));
  assert.equal(satisfies('0.4.0', '^0.3.0'), false);
  assert.ok(satisfies('4.14.0', '^4.13.16'));
  assert.equal(satisfies('5.0.0', '^4.13.16'), false);
  assert.ok(satisfies('1.2.3', '1.2.3'));
  assert.ok(satisfies('1.2.4', '>1.2.3 <=1.2.4'));
});

test('versions inside the declared peer and engine ranges produce no warnings', () => {
  assert.deepEqual(
    unsupportedVersions({
      viteVersion: '8.3.5',
      nodeVersion: '24.22.1',
      installed: installed(supported),
    }),
    [],
  );
});

test('each version outside its declared range produces a warning naming that range', () => {
  const messages = unsupportedVersions({
    viteVersion: '9.0.0',
    nodeVersion: '26.13.1',
    installed: installed({ void: '1.11.0', hono: '5.0.0' }),
  });
  const expected = [
    ['Node 26.13.1', manifest.engines.node],
    ['running Vite 9.0.0', manifest.peerDependencies.vite],
    ['void 1.11.0', manifest.peerDependencies.void],
    ['hono 5.0.0', manifest.peerDependencies.hono],
  ];
  assert.equal(messages.length, expected.length);
  for (const [label, range] of expected)
    assert.ok(
      messages.some((message) => message.includes(label) && message.includes(range)),
      label,
    );
  assert.match(
    messages.find((message) => message.includes('running Vite')),
    /launcher/,
  );
});

test('a missing host Vite version and unresolved packages are reported or skipped without throwing', () => {
  const messages = unsupportedVersions({
    viteVersion: undefined,
    nodeVersion: '24.22.1',
    installed: () => undefined,
  });
  assert.deepEqual(messages.length, 1);
  assert.match(messages[0], /running Vite unknown is outside/);
});

test('warnings go to the Vite logger once per message', () => {
  const warnings = [];
  const logger = { warn: (message) => warnings.push(message) };
  warnUnsupportedVersions(logger, '9.1.0');
  warnUnsupportedVersions(logger, '9.1.0');
  assert.equal(warnings.filter((message) => message.includes('running Vite 9.1.0')).length, 1);
});

test('the pages plugin warns for an unsupported running Vite instead of failing the build', () => {
  const plugin = voidHonoJsx().find((p) => p.name === 'void-hono:pages');
  const warnings = [];
  assert.ok(plugin.config.call({ meta: { viteVersion: '9.2.0' } }, {}, {}).resolve);
  assert.doesNotThrow(() =>
    plugin.configResolved.handler.call(
      { meta: { viteVersion: '9.2.0' } },
      { plugins: [], logger: { warn: (message) => warnings.push(message) } },
    ),
  );
  assert.ok(warnings.some((message) => message.includes('running Vite 9.2.0')));
});

test('every declared range uses comparators that the warning check understands', () => {
  const ranges = { ...manifest.peerDependencies, node: manifest.engines.node };
  for (const [name, range] of Object.entries(ranges))
    for (const comparator of range.trim().split(/\s+/))
      assert.match(comparator, /^(?:>=|<=|>|<|\^|=)?\d+\.\d+\.\d+$/, `${name}: ${range}`);
});
