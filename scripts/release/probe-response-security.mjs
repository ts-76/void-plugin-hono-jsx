// Bounded loopback regression for the publisher's Node and installed undici.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const cli = process.argv[2];
assert.ok(path.isAbsolute(cli));
const undici = path.join(path.dirname(cli), '../node_modules/undici/index.js');
const targets = [
  { name: 'Node built-in fetch', load: 'const fetch = globalThis.fetch;' },
  { name: 'fixed publisher undici', load: `const { fetch } = await import(${JSON.stringify(pathToFileURL(undici).href)});` },
];
const sockets = new Set();
const server = http.createServer((request, response) => {
  if (request.url === '/encoding') {
    response.writeHead(200, { 'content-encoding': 'gzip, gzip, gzip, gzip, gzip, gzip', 'content-length': '100' });
    response.flushHeaders(); setTimeout(() => response.destroy(), 30);
  } else response.end('unexpected body');
});
server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const digest = createHash('sha256').update('expected body').digest('base64');
const results = [];
try {
  for (const target of targets) for (const test of ['encoding', 'sri-lower', 'sri-upper']) {
    const options = test === 'encoding' ? {} : { integrity: `${test === 'sri-upper' ? 'SHA256' : 'sha256'}-${digest}` };
    const code = `${target.load}
      try { const response = await fetch(${JSON.stringify(base + (test === 'encoding' ? '/encoding' : '/sri'))}, ${JSON.stringify(options)}); console.log('accepted', await response.text()); }
      catch (error) { console.log('caught', error.message); }
      setTimeout(() => process.exit(0), 250);`;
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--max-old-space-size=128', '--input-type=module', '-e', code], { env: { PATH: process.env.PATH } });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', (exitCode, signal) => { clearTimeout(timer); resolve({ target: target.name, test, exitCode, signal, stdout, stderr }); });
    });
    assert.equal(result.exitCode, 0, JSON.stringify(result));
    assert.equal(result.signal, null, JSON.stringify(result));
    assert.match(result.stdout, /^caught /, JSON.stringify(result));
    assert.doesNotMatch(result.stderr, /Unhandled|unhandled/, JSON.stringify(result));
    results.push(result);
  }
  console.log(JSON.stringify({ node: process.version, builtinUndici: process.versions.undici, results }));
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
}
