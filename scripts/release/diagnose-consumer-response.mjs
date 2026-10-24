// Local diagnostic only: fake loopback responses, no credentials or publication.
// Run on both the supported Node version and a proposed replacement. Optional
// arguments are absolute paths to additional undici entry files to compare.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const targets = [
  { name: 'Node built-in fetch', load: 'const fetch = globalThis.fetch;' },
  ...[require.resolve('undici'), ...process.argv.slice(2)].map(file => {
    assert.ok(isAbsolute(file), 'Additional undici entry paths must be absolute');
    return { name: file, load: `const { fetch } = await import(${JSON.stringify(pathToFileURL(file).href)});` };
  }),
];
const sockets = new Set();
const server = http.createServer((request, response) => {
  if (request.url === '/encoding') {
    response.writeHead(200, {
      'content-encoding': 'gzip, gzip, gzip, gzip, gzip, gzip',
      'content-length': '100',
    });
    response.flushHeaders();
    setTimeout(() => response.destroy(), 30);
  } else {
    response.end('unexpected body');
  }
});
server.on('connection', socket => {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const digest = createHash('sha256').update('expected body').digest('base64');
const results = [];
try {
  for (const target of targets) {
    for (const test of ['encoding', 'sri-lower', 'sri-upper']) {
      const options = test === 'encoding' ? {} : {
        integrity: `${test === 'sri-upper' ? 'SHA256' : 'sha256'}-${digest}`,
      };
      const code = `${target.load}
        try {
          const response = await fetch(${JSON.stringify(base + (test === 'encoding' ? '/encoding' : '/sri'))}, ${JSON.stringify(options)});
          console.log('accepted', await response.text());
        } catch (error) { console.log('caught', error.message); }
        setTimeout(() => process.exit(0), 200);
      `;
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--max-old-space-size=128', '--input-type=module', '-e', code], {
          env: { PATH: process.env.PATH },
        });
        let stdout = '', stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr += data; });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('close', (exitCode, signal) => {
          clearTimeout(timer);
          resolve({ target: target.name, test, exitCode, signal, stdout, stderr });
        });
      });
      results.push(result);
    }
  }
  const { z } = await import('zod');
  for (const elements of [100, 10000]) {
    for (const max of [false, true]) {
      const schema = max ? z.array(z.string()).max(1) : z.array(z.string());
      const parsed = schema.safeParse(Array(elements).fill(0));
      assert.equal(parsed.success, false);
      results.push({ target: 'installed zod', elements, maxOne: max, issues: parsed.error.issues.length });
    }
  }
  console.log(JSON.stringify({
    node: process.version, builtinUndici: process.versions.undici,
    boundary: 'Local response/array diagnostic; not a production exploit or a release approval',
    results,
  }, null, 2));
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
}
