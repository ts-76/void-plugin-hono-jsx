"""Exercise the unmodified native CLI against a loopback-only registry."""
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
assert os.readlink('/proc/self/ns/net') != os.readlink('/proc/1/ns/net')
subprocess.run(['ip', 'link', 'set', 'lo', 'up'], check=True)
cli, report_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
root = pathlib.Path(tempfile.mkdtemp(prefix='pnpm-native-probe-'))
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
        auth = cwd / 'user.npmrc'; auth.write_text('')
        env = dict(PATH='/usr/bin:/bin', XDG_CONFIG_HOME=str(cwd/'config'), XDG_DATA_HOME=str(cwd/'data'), XDG_CACHE_HOME=str(cwd/'cache'), PNPM_HOME=str(cwd/'pnpm-home'), GITHUB_ACTIONS='true', ACTIONS_ID_TOKEN_REQUEST_URL=registry+'identity?fixture=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN='fixture-request', GITHUB_SERVER_URL='https://github.com', GITHUB_REPOSITORY='fixture/repo', GITHUB_WORKFLOW_REF='fixture/repo/.github/workflows/npm-stage.yml@refs/tags/v0.1.0-alpha.0', GITHUB_REF='refs/tags/v0.1.0-alpha.0', GITHUB_SHA='fixture-commit', GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_RUN_ID='fixture-run', GITHUB_RUN_ATTEMPT='1', RUNNER_ENVIRONMENT='github-hosted')
        args = [str(cli), 'stage', 'publish', str(tarball), '--ignore-scripts', '--json', '--reporter=silent', '--no-git-checks', '--ignore-workspace', '--registry', registry, '--userconfig', str(auth), '--tag', 'next', '--access', 'public', '--provenance' if case == 'signing-failure' else '--no-provenance']
        if case == 'dry-run': args += ['--dry-run']
        result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=25)
        posts = [r for r in records if r['path'].startswith('/-/stage/package/')]
        outcome = dict(case=case, exitCode=result.returncode, stdout=result.stdout, stderr=result.stderr, requests=list(records), stagePosts=len(posts))
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
        else:
            assert result.returncode == 0 and not posts, outcome
        outcomes.append(outcome)
    report_dir.joinpath('native-protocol.json').write_text(json.dumps(dict(isolation='Linux network namespace; loopback only; fake credentials only', signing='only failure before signing is exercised; successful Fulcio/Rekor/registry provenance is unverified', fixtureSha256=hashlib.sha256(data).hexdigest(), cases=outcomes), indent=2) + '\n')
    print('Native Linux pnpm: 5 protocol cases passed; no lifecycle or direct publication')
finally:
    server.shutdown()
    shutil.rmtree(root)
