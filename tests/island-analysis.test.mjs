import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { honoIslands } from '../packages/void-plugin-hono-jsx/src/plugins/islands/plugin.ts';

function fixture() {
  const previous = process.cwd();
  const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'hono-island-analysis-')));
  fs.mkdirSync(join(root, 'pages'));
  fs.mkdirSync(join(root, 'components'));
  process.chdir(root);
  const plugin = honoIslands();
  const sent = [],
    invalidated = [];
  const environment = {
    config: { consumer: 'client' },
    moduleGraph: {
      getModuleById(id) {
        return { id };
      },
      invalidateModule(module) {
        invalidated.push(module.id);
      },
    },
    hot: {
      send(value) {
        sent.push(value);
      },
    },
  };
  return {
    root,
    plugin,
    environment,
    sent,
    invalidated,
    write(file, source) {
      fs.mkdirSync(join(root, file, '..'), { recursive: true });
      fs.writeFileSync(join(root, file), source);
    },
    update(file, type = 'update') {
      return plugin.hotUpdate.call(
        { environment },
        { file: join(root, file), type, modules: [], timestamp: Date.now() },
      );
    },
    cleanup() {
      process.chdir(previous);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test('100 pages and a root layout read a shared re-export graph once per analysis generation', async () => {
  const f = fixture();
  const read = fs.readFileSync;
  try {
    f.write('components/Shared.tsx', 'export default function Shared(){return <p>Shared</p>}');
    f.write('components/barrel/index.ts', 'export {default} from "../Shared";');
    f.write(
      'pages/layout.tsx',
      'import Shared from "../components/barrel"; export default function Layout({children}){return <main><Shared/>{children}</main>}',
    );
    for (let i = 0; i < 100; i++)
      f.write(
        `pages/p${i}.tsx`,
        'import Shared from "../components/barrel"; export default function Page(){return <Shared/>}',
      );
    const counts = new Map();
    fs.readFileSync = function (file, ...args) {
      const name = String(file);
      if (name.startsWith(f.root)) counts.set(name, (counts.get(name) ?? 0) + 1);
      return read.call(this, file, ...args);
    };
    syncBuiltinESMExports();
    await f.plugin.buildStart();
    for (const file of ['components/Shared.tsx', 'components/barrel/index.ts', 'pages/layout.tsx'])
      assert.equal(counts.get(join(f.root, file)), 1, file);
    await f.plugin.buildStart();
    for (const file of ['components/Shared.tsx', 'components/barrel/index.ts', 'pages/layout.tsx'])
      assert.equal(
        counts.get(join(f.root, file)),
        2,
        'new generations must not retain cached source',
      );
  } finally {
    fs.readFileSync = read;
    syncBuiltinESMExports();
    f.cleanup();
  }
});

test('editing a shared interactive dependency revalidates boundaries and recovers after the error is fixed', async () => {
  const f = fixture();
  try {
    f.write(
      'pages/index.tsx',
      'import Shared from "../components/Shared"; export default function Page(){return <Shared/>}',
    );
    f.write(
      'components/Counter.tsx',
      'export default function Counter(){return <button>Count</button>}',
    );
    const valid =
      'import Counter from "./Counter"; export default function Shared(){return <Counter/>}';
    f.write('components/Shared.tsx', valid);
    await f.plugin.buildStart();
    f.write(
      'components/Shared.tsx',
      valid.replace('from "./Counter";', 'from "./Counter" with { island: "load" };'),
    );
    await assert.rejects(
      () => f.update('components/Shared.tsx'),
      /attributed imports inside an interactive component/,
    );
    f.write('components/Shared.tsx', valid);
    await f.update('components/Shared.tsx');
    assert.equal(f.invalidated.length, 3);
    assert.deepEqual(f.sent, [{ type: 'full-reload' }]);
    f.write('components/Counter.tsx', 'not valid (');
    await assert.rejects(() => f.update('components/Counter.tsx'));
    f.write(
      'components/Counter.tsx',
      'export default function Counter(){return <button>Recovered</button>}',
    );
    await f.update('components/Counter.tsx');
    assert.equal(f.sent.length, 2);
  } finally {
    f.cleanup();
  }
});

test('new and deleted component files outside pages invalidate unresolved import edges', async () => {
  const f = fixture();
  try {
    f.write(
      'pages/index.tsx',
      'import Added from "../components/Added"; export default function Page(){return <Added/>}',
    );
    f.write(
      'components/Counter.tsx',
      'export default function Counter(){return <button>Count</button>}',
    );
    await f.plugin.buildStart();
    f.write(
      'components/Added.tsx',
      'import Counter from "./Counter" with { island: "idle" }; export default function Added(){return <Counter/>}',
    );
    await assert.rejects(
      () => f.update('components/Added.tsx', 'create'),
      /attributed imports inside an interactive component/,
    );
    fs.unlinkSync(join(f.root, 'components/Added.tsx'));
    await f.update('components/Added.tsx', 'delete');
    f.write('components/Added.tsx', 'export default function Added(){return <p>Recovered</p>}');
    await f.update('components/Added.tsx', 'create');
    assert.equal(f.sent.length, 2);
    f.write(
      'components/Unrelated.tsx',
      'export default function Unrelated(){return <p>Unused</p>}',
    );
    await f.update('components/Unrelated.tsx', 'create');
    assert.equal(f.sent.length, 2, 'unrelated additions must not trigger a graph reload');
  } finally {
    f.cleanup();
  }
});

test('static dependency changes replace island targets rather than reusing the previous graph', async () => {
  const f = fixture();
  try {
    f.write(
      'pages/index.island.tsx',
      'import Wrapper from "../components/Wrapper"; export default function Page(){return <Wrapper/>}',
    );
    for (const name of ['First', 'Second'])
      f.write(
        `components/${name}.tsx`,
        `export default function ${name}(){return <button>${name}</button>}`,
      );
    const wrapper = (name) =>
      `import Counter from "./${name}" with { island: "visible" }; export default function Wrapper(){return <Counter/>}`;
    f.write('components/Wrapper.tsx', wrapper('First'));
    await f.plugin.buildStart();
    assert.match(
      f.plugin.load(f.plugin.resolveId('virtual:void-islands-client')),
      /components\/First\.tsx/,
    );
    f.write('components/Wrapper.tsx', wrapper('Second'));
    await f.update('components/Wrapper.tsx');
    const client = f.plugin.load(f.plugin.resolveId('virtual:void-islands-client'));
    assert.match(client, /components\/Second\.tsx/);
    assert.doesNotMatch(client, /components\/First\.tsx/);
  } finally {
    f.cleanup();
  }
});

test('failed island analysis keeps the last complete entry and watches newly discovered dependencies for recovery', async () => {
  const f = fixture();
  try {
    f.write(
      'pages/index.island.tsx',
      'import Wrapper from "../components/Wrapper"; export default Wrapper;',
    );
    f.write(
      'components/First.tsx',
      'export default function First(){return <button>First</button>}',
    );
    f.write(
      'components/Wrapper.tsx',
      'import Counter from "./First" with { island: "load" }; export default Counter;',
    );
    await f.plugin.buildStart();
    const entry = f.plugin.resolveId('virtual:void-islands-client');
    const previous = f.plugin.load(entry);
    f.write(
      'components/Wrapper.tsx',
      'import Counter from "./Second" with { island: "load" }; export default Counter;',
    );
    f.write('components/Second.tsx', 'invalid syntax (');
    await assert.rejects(() => f.update('components/Wrapper.tsx'), /cannot parse/);
    assert.equal(
      f.plugin.load(entry),
      previous,
      'failed analysis must not publish partial island targets',
    );
    f.write(
      'components/Second.tsx',
      'export default function Second(){return <button>Recovered</button>}',
    );
    await f.update('components/Second.tsx');
    assert.match(f.plugin.load(entry), /components\/Second\.tsx/);
    assert.doesNotMatch(f.plugin.load(entry), /components\/First\.tsx/);
    assert.equal(f.sent.length, 1);
  } finally {
    f.cleanup();
  }
});

test(
  'missing imports through symlink directories invalidate on the canonical target event',
  { skip: process.platform === 'win32' },
  async () => {
    const f = fixture();
    try {
      fs.mkdirSync(join(f.root, 'shared'));
      fs.symlinkSync(join(f.root, 'shared'), join(f.root, 'components/linked'), 'dir');
      f.write(
        'pages/index.tsx',
        'import Added from "../components/linked/Added"; export default function Page(){return <Added/>}',
      );
      f.write(
        'components/Counter.tsx',
        'export default function Counter(){return <button>Count</button>}',
      );
      await f.plugin.buildStart();
      f.write(
        'shared/Added.tsx',
        'import Counter from "../components/Counter" with { island: "load" }; export default function Added(){return <Counter/>}',
      );
      await assert.rejects(
        () => f.update('shared/Added.tsx', 'create'),
        /attributed imports inside an interactive component/,
      );
      f.write('shared/Added.tsx', 'export default function Added(){return <p>Recovered</p>}');
      await f.update('shared/Added.tsx');
      assert.deepEqual(f.sent, [{ type: 'full-reload' }]);
    } finally {
      f.cleanup();
    }
  },
);

test('an island component edit that keeps the island graph is left to its own HMR handler', async () => {
  const f = fixture();
  const hot = async (file) => {
    const timestamp = Date.now() + Math.random();
    const path = join(f.root, file);
    await f.plugin.hotUpdate.call(
      { environment: f.environment },
      { file: path, type: 'update', modules: [], timestamp },
    );
    return f.plugin.api.hotSwapsIsland(path, timestamp);
  };
  try {
    f.write(
      'pages/index.island.tsx',
      'import Counter from "../components/Counter" with { island: "load" }; export default function Page(){return <Counter/>}',
    );
    // The same component with another policy: the manifest keeps one policy per island id.
    f.write(
      'pages/other.island.tsx',
      'import Counter from "../components/Counter" with { island: "idle" }; export default function Page(){return <Counter/>}',
    );
    f.write('components/label.ts', 'export const label = "Count";');
    f.write(
      'components/Counter.tsx',
      'import { label } from "./label"; export default function Counter(){return <button>{label}</button>}',
    );
    await f.plugin.buildStart();
    // Page transforms register their island imports into the live manifest again,
    // so its policy for the shared island id differs from the last analysis.
    for (const page of ['pages/other.island.tsx', 'pages/index.island.tsx'])
      f.plugin.transform.call(
        { environment: { mode: 'dev', config: { consumer: 'server' } } },
        fs.readFileSync(join(f.root, page), 'utf8'),
        join(f.root, page),
      );
    f.write(
      'components/Counter.tsx',
      'import { label } from "./label"; export default function Counter(){return <button>{label}!</button>}',
    );
    assert.equal(await hot('components/Counter.tsx'), true);
    assert.deepEqual(f.sent, []);
    assert.equal(await hot('components/label.ts'), false, 'a dependency edit still reloads');
    assert.equal(f.sent.length, 1);
  } finally {
    f.cleanup();
  }
});

test('only development client transforms of island components accept their own updates', async () => {
  const f = fixture();
  try {
    f.write(
      'pages/index.island.tsx',
      'import Counter from "../components/Counter" with { island: "load" }; export default function Page(){return <Counter/>}',
    );
    const source = 'export default function Counter(){return <button>Count</button>}';
    f.write('components/Counter.tsx', source);
    f.write('components/Other.tsx', source);
    await f.plugin.buildStart();
    const transform = (environment, file) =>
      f.plugin.transform.call({ environment }, source, join(f.root, file));
    const client = transform(
      { mode: 'dev', config: { consumer: 'client' } },
      'components/Counter.tsx',
    );
    assert.match(client.code, /import\.meta\.hot\.accept/);
    assert.match(client.code, /__remountHonoIslands\(\["components\/Counter\.tsx"\]/);
    for (const [environment, file] of [
      [{ mode: 'dev', config: { consumer: 'server' } }, 'components/Counter.tsx'],
      [{ mode: 'build', config: { consumer: 'client' } }, 'components/Counter.tsx'],
      [{ mode: 'dev', config: { consumer: 'client' } }, 'components/Other.tsx'],
    ])
      assert.equal(transform(environment, file), undefined, file);
  } finally {
    f.cleanup();
  }
});

test('removing a hot-accepting component after it left the island graph reloads the page', async () => {
  const f = fixture();
  try {
    f.write(
      'pages/index.island.tsx',
      'import Counter from "../components/Counter" with { island: "load" }; export default function Page(){return <Counter/>}',
    );
    const source = 'export default function Counter(){return <button>Count</button>}';
    f.write('components/Counter.tsx', source);
    await f.plugin.buildStart();
    f.plugin.transform.call(
      { environment: { mode: 'dev', config: { consumer: 'client' } } },
      source,
      join(f.root, 'components/Counter.tsx'),
    );
    f.write('pages/index.island.tsx', 'export default function Page(){return <p>Static</p>}');
    await f.update('pages/index.island.tsx');
    assert.deepEqual(f.sent, [], 'the pages plugin owns page edits');
    fs.rmSync(join(f.root, 'components/Counter.tsx'));
    assert.deepEqual(await f.update('components/Counter.tsx', 'delete'), []);
    assert.deepEqual(f.sent, [{ type: 'full-reload' }]);
  } finally {
    f.cleanup();
  }
});
