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
if not local:
    assert os.readlink('/proc/self/ns/net') != os.readlink('/proc/1/ns/net')
    subprocess.run(['ip', 'link', 'set', 'lo', 'up'], check=True)
cli, report_dir = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve()
node = os.environ.get('PUBLISHER_NODE') or shutil.which('node')
assert node
root = pathlib.Path(tempfile.mkdtemp(prefix='pnpm-js-probe-')).resolve()
report_dir.mkdir(parents=True, exist_ok=True)
source = cli.read_text()
coverage_helper = pathlib.Path(__file__).with_name('publisher.mjs').resolve()
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
    for case in ['fixed-tarball', 'oidc-missing-token', 'signing-failure', 'stage-500', 'dry-run']:
        records.clear()
        cwd = root / case; cwd.mkdir()
        auth = cwd / 'user.npmrc'; auth.write_text('' if case == 'oidc-missing-token' else f'//127.0.0.1:{server.server_port}/:_authToken=fixture-exchanged-token\n')
        coverage = cwd / 'coverage'; coverage.mkdir()
        env = dict(PATH=str(pathlib.Path(node).parent)+':/usr/bin:/bin', HOME=str(cwd), NODE_V8_COVERAGE=str(coverage), NPM_CONFIG_USERCONFIG=str(auth), NPM_CONFIG_GLOBALCONFIG=str(cwd/'global.npmrc'), XDG_CONFIG_HOME=str(cwd/'config'), XDG_DATA_HOME=str(cwd/'data'), XDG_CACHE_HOME=str(cwd/'cache'), PNPM_HOME=str(cwd/'pnpm-home'), GITHUB_ACTIONS='true', ACTIONS_ID_TOKEN_REQUEST_URL=registry+'identity?fixture=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN='fixture-request', GITHUB_SERVER_URL='https://github.com', GITHUB_REPOSITORY='fixture/repo', GITHUB_WORKFLOW_REF='fixture/repo/.github/workflows/npm-stage.yml@refs/tags/v0.1.0-alpha.0', GITHUB_REF='refs/tags/v0.1.0-alpha.0', GITHUB_SHA='fixture-commit', GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_RUN_ID='fixture-run', GITHUB_RUN_ATTEMPT='1', RUNNER_ENVIRONMENT='github-hosted')
        args = [node, *(['--require', str(guard)] if local else []), str(cli), 'stage', 'publish', str(tarball), '--ignore-scripts', '--json', '--workspaces=false', '--registry', registry, '--tag', 'next', '--access', 'public', '--provenance' if case == 'signing-failure' else '--no-provenance']
        if case == 'dry-run': args += ['--dry-run']
        result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=25)
        posts = [r for r in records if r['path'].startswith('/-/stage/package/')]
        coverage_runner = cwd / 'coverage.mjs'
        coverage_runner.write_text(f"import {{measurePublisherCoverage}} from {json.dumps(coverage_helper.as_uri())};import {{readFileSync}} from 'node:fs';const report=measurePublisherCoverage({json.dumps(str(cli))},{json.dumps(str(coverage))});console.log(JSON.stringify(report));")
        measured = subprocess.run([node, str(coverage_runner)], capture_output=True, text=True, check=True)
        outcome = dict(executionCoverage=json.loads(measured.stdout), case=case, exitCode=result.returncode, stdout=result.stdout, stderr=result.stderr, requests=list(records), stagePosts=len(posts))
        assert not marker.exists(), 'Lifecycle script ran'
        assert all(r['method'] != 'PUT' for r in records), 'Direct publish attempted'
        if case == 'fixed-tarball':
            assert result.returncode == 0 and len(posts) == 1, outcome
            receipt = json.loads(result.stdout)[name]; assert receipt['integrity'] == integrity and receipt['stageId']
            assert posts[0]['authorization'] == 'Bearer fixture-exchanged-token'
            doc = posts[0]['body']; assert doc['dist-tags'] == {'next': version} and doc['access'] == 'public'
            assert base64.b64decode(doc['_attachments'][f'{name}-{version}.tgz']['data']) == data
        elif case == 'oidc-missing-token':
            assert result.returncode != 0 and not posts, outcome
        elif case == 'signing-failure':
            assert result.returncode != 0 and not posts, outcome
            assert any('audience=sigstore' in r['path'] for r in records), outcome
        elif case == 'stage-500':
            assert result.returncode != 0 and len(posts) == 1, outcome
        else:
            assert result.returncode == 0 and not posts, outcome
        outcomes.append(outcome)
    response_check = subprocess.run([node, str(pathlib.Path(__file__).with_name('probe-response-security.mjs')), str(cli)], capture_output=True, text=True, timeout=45)
    assert response_check.returncode == 0, response_check.stderr
    report_dir.joinpath('response-security.json').write_text(response_check.stdout)
    report_dir.joinpath('protocol.json').write_text(json.dumps(dict(isolation='Node socket guard' if local else 'Linux network namespace; loopback only; fake credentials only', signing='only failure before signing is exercised; successful Fulcio/Rekor/registry provenance is unverified', fixtureSha256=hashlib.sha256(data).hexdigest(), cases=outcomes), indent=2) + '\n')
    print('Fixed npm runtime: 5 protocol and 6 response-security cases passed; exact stage command coverage verified')
finally:
    server.shutdown()
    shutil.rmtree(root)
