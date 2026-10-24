"""Exercise the unmodified JavaScript CLI against a loopback-only registry."""
import base64
import hashlib
import http.server
import io
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
import urllib.parse

# Run only inside a fresh Linux network namespace. No real npm/GitHub/Sigstore
# service or credential is accessible to this probe.
local = '--local' in sys.argv
malformed_oidc = '--malformed-oidc' in sys.argv
if not local:
    assert os.readlink('/proc/self/ns/net') != os.readlink('/proc/1/ns/net')
    subprocess.run(['ip', 'link', 'set', 'lo', 'up'], check=True)
cli, report_dir = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve()
node = os.environ.get('PNPM_RELEASE_NODE') or shutil.which('node')
assert node
root = pathlib.Path(tempfile.mkdtemp(prefix='pnpm-js-probe-')).resolve()
report_dir.mkdir(parents=True, exist_ok=True)
source = cli.read_text()
coverage_helper = pathlib.Path(__file__).with_name('publisher-coverage.mjs').resolve()
# Local development uses a socket guard; CI additionally has a network namespace.
guard = root / 'loopback.cjs'
guard.write_text("const net=require('node:net');const tls=require('node:tls');for(const [obj,key] of [[net.Socket.prototype,'connect'],[tls,'connect']]){const original=obj[key];obj[key]=function(...args){let a=args[0];if(Array.isArray(a))a=a[0];const host=typeof a==='object'?a.host:typeof args[1]==='string'?args[1]:'localhost';if(host&&!['127.0.0.1','localhost','::1'].includes(host))throw Error('Non-loopback connection blocked: '+host);return original.apply(this,args)}}")
records, case = [], ''
name, version = 'void-plugin-hono-jsx', '0.1.0-alpha.0'

class Registry(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def respond(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        records.append(dict(method=self.command, path=self.path, authorization=self.headers.get('Authorization'), body=json.loads(body) if body else None))
        if case == 'malformed-oidc' and '/oidc/token/exchange/' in self.path:
            # Bounded negative response: no actual compressed payload or OOM.
            self.send_response(200)
            self.send_header('Content-Encoding', 'gzip, gzip, gzip, gzip, gzip, gzip')
            self.send_header('Content-Length', '100')
            self.end_headers()
            self.wfile.flush()
            import time
            time.sleep(0.03)
            self.close_connection = True
            return
        status, response = 200, {}
        if self.path.startswith('/identity'):
            audience = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)['audience'][0]
            payload = dict(repository_visibility='public', iss='https://token.actions.githubusercontent.com', sub='fixture', aud=audience)
            jwt = 'e30.' + base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=') + '.fixture'
            response = dict(value='invalid-sigstore-token' if audience == 'sigstore' else jwt)
        elif '/oidc/token/exchange/' in self.path:
            response = {} if case == 'oidc-missing-token' else dict(token='fixture-exchanged-token')
        elif self.path.startswith('/-/stage/package/'):
            status = 500 if case == 'stage-500' else 401 if case == 'oidc-missing-token' else 201
            response = dict(stageId='00000000-0000-4000-8000-000000000001') if status == 201 else dict(error='fixture-rejection')
        elif self.command == 'GET' and self.path.startswith('/-/package/'):
            response = dict(public=True)
        elif self.command == 'GET':
            status, response = 404, dict(error='not found')
        else:
            status, response = 500, dict(error='unexpected-request')
        raw = json.dumps(response).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)
    do_GET = respond
    do_POST = respond
    do_PUT = respond

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Registry)
threading.Thread(target=server.serve_forever, daemon=True).start()
registry = f'http://127.0.0.1:{server.server_port}/'
marker = root / 'unexpected-lifecycle'
manifest = dict(name=name, version=version, license='MIT', publishConfig=dict(registry=registry, access='public', tag='next'), scripts=dict(prepublishOnly=f'touch {marker}', publish=f'touch {marker}'))
tarball = root / 'fixed-fixture.tgz'
with tarfile.open(tarball, 'w:gz') as tar:
    for file, content in [('package/package.json', json.dumps(manifest)), ('package/README.md', 'Controlled fixture')]:
        raw = content.encode(); entry = tarfile.TarInfo(file); entry.size = len(raw); tar.addfile(entry, io.BytesIO(raw))
data = tarball.read_bytes()
integrity = 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()
outcomes = []
try:
    for case in ['fixed-tarball', 'oidc-missing-token', 'signing-failure', 'stage-500', 'dry-run'] + (['malformed-oidc'] if malformed_oidc else []):
        records.clear()
        cwd = root / case; cwd.mkdir()
        auth = cwd / 'user.npmrc'; auth.write_text('')
        coverage = cwd / 'coverage'; coverage.mkdir()
        env = dict(PATH=str(pathlib.Path(node).parent)+':/usr/bin:/bin', HOME=str(cwd), NODE_V8_COVERAGE=str(coverage), NPM_CONFIG_USERCONFIG=str(auth), NPM_CONFIG_GLOBALCONFIG=str(cwd/'global.npmrc'), XDG_CONFIG_HOME=str(cwd/'config'), XDG_DATA_HOME=str(cwd/'data'), XDG_CACHE_HOME=str(cwd/'cache'), PNPM_HOME=str(cwd/'pnpm-home'), GITHUB_ACTIONS='true', ACTIONS_ID_TOKEN_REQUEST_URL=registry+'identity?fixture=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN='fixture-request', GITHUB_SERVER_URL='https://github.com', GITHUB_REPOSITORY='fixture/repo', GITHUB_WORKFLOW_REF='fixture/repo/.github/workflows/npm-stage.yml@refs/tags/v0.1.0-alpha.0', GITHUB_REF='refs/tags/v0.1.0-alpha.0', GITHUB_SHA='fixture-commit', GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_RUN_ID='fixture-run', GITHUB_RUN_ATTEMPT='1', RUNNER_ENVIRONMENT='github-hosted')
        args = [node, *(['--require', str(guard)] if local else []), str(cli), 'stage', 'publish', str(tarball), '--ignore-scripts', '--json', '--reporter=silent', '--no-git-checks', '--ignore-workspace', '--registry', registry, '--tag', 'next', '--access', 'public', '--provenance' if case == 'signing-failure' else '--no-provenance']
        if case == 'dry-run': args += ['--dry-run']
        result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=25)
        posts = [r for r in records if r['path'].startswith('/-/stage/package/')]
        coverage_runner = cwd / 'coverage.mjs'
        coverage_runner.write_text(f"import {{bracesCoverage,assertNoBracesCalls}} from {json.dumps(coverage_helper.as_uri())};import {{readFileSync}} from 'node:fs';const report=bracesCoverage(readFileSync({json.dumps(str(cli))},'utf8'),{json.dumps(cli.as_uri())},{json.dumps(str(coverage))});assertNoBracesCalls(report);console.log(JSON.stringify(report));")
        measured = subprocess.run([node, str(coverage_runner)], capture_output=True, text=True, check=True)
        outcome = dict(braces=json.loads(measured.stdout), case=case, exitCode=result.returncode, stdout=result.stdout, stderr=result.stderr, requests=list(records), stagePosts=len(posts))
        assert not marker.exists(), 'Lifecycle script ran'
        assert all(r['method'] != 'PUT' for r in records), 'Direct publish attempted'
        if case == 'fixed-tarball':
            assert result.returncode == 0 and len(posts) == 1, outcome
            receipt = json.loads(result.stdout)[name]; assert receipt['integrity'] == integrity and receipt['stageId']
            assert posts[0]['authorization'] == 'Bearer fixture-exchanged-token'
            doc = posts[0]['body']; assert doc['dist-tags'] == {'next': version} and doc['access'] == 'public'
            assert base64.b64decode(doc['_attachments'][f'{name}-{version}.tgz']['data']) == data
        elif case == 'oidc-missing-token':
            assert result.returncode != 0 and len(posts) == 1 and posts[0]['authorization'] is None, outcome
        elif case == 'signing-failure':
            assert result.returncode != 0 and not posts, outcome
            assert any('audience=sigstore' in r['path'] for r in records), outcome
        elif case == 'stage-500':
            assert result.returncode != 0 and len(posts) == 1, outcome
        elif case == 'malformed-oidc':
            assert result.returncode != 0 and not posts, outcome
            # Report vulnerable versus handled failure; neither is a stage success.
            outcome['unhandledStreamError'] = "Unhandled 'error' event" in result.stderr
        else:
            assert result.returncode == 0 and not posts, outcome
        outcomes.append(outcome)
    # A separate prefix copy calls the real bundled functions on a small benign pattern.
    # It is not the published CLI and is used only to validate coverage sensitivity.
    import re
    matches = list(re.finditer(r'^// ([^\n]+)\n', source, re.M))
    brace = next(i for i,m in enumerate(matches) if m[1].endswith('/node_modules/braces/index.js'))
    prefix = source[:matches[brace+1].start()]
    positive = root / 'positive.mjs'
    positive.write_text(prefix + "\nconst b=require_braces();b.parse('{a,b}');b.compile('{a,b}');b.expand('{a,b}');\n")
    positive_coverage=root/'positive-coverage';positive_coverage.mkdir()
    positive_run=subprocess.run([node,str(positive)], env={'PATH':str(pathlib.Path(node).parent)+':/usr/bin:/bin','HOME':str(root),'NODE_V8_COVERAGE':str(positive_coverage)}, capture_output=True,text=True)
    assert positive_run.returncode == 0, positive_run.stderr
    runner=root/'positive-check.mjs'
    runner.write_text(f"import {{bracesCoverage}} from {json.dumps(coverage_helper.as_uri())};import assert from 'node:assert/strict';import {{readFileSync}} from 'node:fs';const report=bracesCoverage(readFileSync({json.dumps(str(positive))},'utf8'),{json.dumps(positive.as_uri())},{json.dumps(str(positive_coverage))});for(const name of ['parse','compile','expand'])assert.ok(report.find(m=>m.module==='braces/lib/'+name+'.js').functions.some(f=>!f.initializer&&f.count>0),name);console.log(JSON.stringify(report));")
    positive_result=subprocess.run([node,str(runner)],capture_output=True,text=True)
    assert positive_result.returncode == 0, positive_result.stderr
    report_dir.joinpath('positive-control.json').write_text(positive_result.stdout)
    report_dir.joinpath('protocol.json').write_text(json.dumps(dict(isolation='Node socket guard' if local else 'Linux network namespace; loopback only; fake credentials only', signing='only failure before signing is exercised; successful Fulcio/Rekor/registry provenance is unverified', fixtureSha256=hashlib.sha256(data).hexdigest(), cases=outcomes), indent=2) + '\n')
    print(f'pnpm JavaScript: {len(outcomes)} protocol cases and braces positive control passed; no brace calls during stage fixtures')
finally:
    server.shutdown()
    shutil.rmtree(root)
