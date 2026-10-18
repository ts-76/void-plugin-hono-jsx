import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

test('publish dry-run accepts an already-published version without upload, lifecycle scripts or byte changes', async () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'void-publish-dry-run-'));
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.method);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ name: 'void-dry-run-fixture', versions: { '1.0.0': { version: '1.0.0' } } }));
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const registry = `http://127.0.0.1:${server.address().port}/`;
    const gate = path.join(temporary, 'gate.mjs');
    // The real helper is executed with only its registry constant redirected to
    // a local endpoint which reports the candidate's version as already public.
    writeFileSync(gate, `export const registry = ${JSON.stringify(registry)};`);
    const helper = path.join(temporary, 'dry-run.mjs');
    const source = fileURLToPath(new URL('../scripts/release/dry-run.mjs', import.meta.url));
    writeFileSync(helper, readFileSync(source));
    const packageDir=path.join(temporary,'package'); mkdirSync(packageDir);
    const marker=path.join(temporary,'lifecycle-ran');
    const lifecycle=`node -e ${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unexpected')`)}`;
    writeFileSync(path.join(packageDir,'package.json'),JSON.stringify({ name:'void-dry-run-fixture', version:'1.0.0', scripts: { prepublishOnly:lifecycle, publish:lifecycle, postpublish:lifecycle }, publishConfig: { registry, access:'public', tag:'next' } }));
    writeFileSync(path.join(packageDir,'index.js'),'export default 1;\n');
    const tarball=path.join(temporary,'fixture.tgz');
    execFileSync('tar',['-czf',tarball,'-C',temporary,'package']);
    const digest=()=>createHash('sha256').update(readFileSync(tarball)).digest('hex');
    const before=digest();
    const npmCli=process.env.npm_execpath;
    assert.ok(npmCli,'Run through npm test');
    const runner=path.join(temporary,'runner.mjs');
    writeFileSync(runner, `import { publishDryRun } from './dry-run.mjs';\nconst result=publishDryRun({ npmCli:${JSON.stringify(npmCli)},tarball:${JSON.stringify(tarball)},distTag:'next',cwd:${JSON.stringify(temporary)},env:process.env });\nconsole.log(JSON.stringify(result));`);
    const env={ PATH:process.env.PATH, HOME:temporary, NPM_CONFIG_USERCONFIG:path.join(temporary,'empty.npmrc'), NPM_CONFIG_CACHE:path.join(temporary,'cache'), NPM_CONFIG_UPDATE_NOTIFIER:'false', NPM_CONFIG_AUDIT:'false' };
    writeFileSync(env.NPM_CONFIG_USERCONFIG,'');
    const { stdout }=await promisify(execFile)(process.execPath,[runner],{cwd:temporary,env,timeout:20_000});
    const result=JSON.parse(stdout);
    const contents = Array.isArray(result) ? result[0] : result['void-dry-run-fixture'] ?? result;
    assert.equal(contents.name,'void-dry-run-fixture');
    assert.equal(contents.version,'1.0.0');
    assert.equal(digest(),before);
    assert.equal(existsSync(marker),false);
    assert.deepEqual(requests,[], 'Dry run must not read/write registry or upload the package');
  } finally {
    await new Promise(resolve=>server.close(resolve));
    rmSync(temporary,{recursive:true,force:true});
  }
});
