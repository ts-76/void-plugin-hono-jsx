"""Read-only evaluation of pnpm's locked Linux build; never publishes."""
import hashlib
import io
import json
import os
import pathlib
import re
import subprocess
import tarfile
import urllib.request

policy = json.loads(pathlib.Path(__file__).with_name('publisher-policy.json').read_text())
COMMIT = policy['sourceCommit']
ARCHIVE_SHA256 = policy['sourceArchiveSha256']
base = pathlib.Path(os.environ['RUNNER_TEMP'])
report = base / 'publisher-rust-report'
report.mkdir()
archive = urllib.request.urlopen(f'https://codeload.github.com/pnpm/pnpm/tar.gz/{COMMIT}', timeout=45).read()
assert hashlib.sha256(archive).hexdigest() == ARCHIVE_SHA256
source_parent = base / 'publisher-rust-source'
source_parent.mkdir()
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
    tar.extractall(source_parent, filter='data')
source = source_parent / f'pnpm-{COMMIT}'
assert hashlib.sha256((source / 'Cargo.lock').read_bytes()).hexdigest() == policy['cargoLockSha256']
env = os.environ.copy()
env.update(CARGO_HOME=str(base / 'publisher-cargo'), RUSTUP_HOME=str(base / 'publisher-rustup'))
subprocess.run(['rustup', 'toolchain', 'install', '1.97.0', '--profile', 'minimal'], env=env, check=True)
def cargo(args, output):
    result = subprocess.run(['rustup', 'run', '1.97.0', 'cargo', *args], cwd=source, env=env, check=True, capture_output=True, text=True, timeout=360)
    (report / output).write_text(result.stdout)
    return result.stdout

tree = cargo(['tree', '--locked', '-p', 'pnpm-cli', '--target', 'x86_64-unknown-linux-gnu', '--edges', 'normal,build', '--prefix', 'none', '--format', '{p}|{f}'], 'cargo-tree.txt')
metadata = json.loads(cargo(['metadata', '--locked', '--format-version', '1', '--filter-platform', 'x86_64-unknown-linux-gnu'], 'cargo-metadata.json'))
external = {(p['name'], p['version']): p for p in metadata['packages'] if (p.get('source') or '').startswith('registry+')}
selected = {}
for line in tree.splitlines():
    match = re.match(r'^([\w-]+) v([\w.+-]+)[^|]*\|(.*)$', line)
    if match and (match[1], match[2]) in external:
        selected.setdefault((match[1], match[2]), set()).update(filter(None, match[3].replace(' (*)', '').split(',')))
inventory = [dict(name=n, version=v, features=sorted(features)) for (n,v), features in sorted(selected.items())]
inventory_text = json.dumps(inventory, indent=2) + '\n'
(report / 'inventory.json').write_text(inventory_text)
reviewed = pathlib.Path(__file__).with_name('publisher-rust-inventory.json')
if reviewed.exists():
    if inventory_text != reviewed.read_text():
        before = {(p['name'], p['version']): p for p in json.loads(reviewed.read_text())}
        after = {(p['name'], p['version']): p for p in inventory}
        print(json.dumps(dict(removed=[p for k,p in before.items() if after.get(k) != p], added=[p for k,p in after.items() if before.get(k) != p]), indent=2), flush=True)
    assert inventory_text == reviewed.read_text(), 'Linux publisher build inventory changed; reassess'

queries = [dict(package=dict(name=p['name'], ecosystem='crates.io'), version=p['version']) for p in inventory]
request = urllib.request.Request('https://api.osv.dev/v1/querybatch', data=json.dumps(dict(queries=queries)).encode(), headers={'Content-Type': 'application/json'})
results = json.load(urllib.request.urlopen(request, timeout=60))['results']
assert len(results) == len(inventory), 'Incomplete publisher audit'
findings = []
for package, result in zip(inventory, results):
    assert not result.get('next_page_token'), 'Publisher audit pagination requires review'
    for item in result.get('vulns', []):
        advisory = json.load(urllib.request.urlopen(f"https://api.osv.dev/v1/vulns/{item['id']}", timeout=30))
        findings.append(dict(package=package, advisory=advisory))
(report / 'findings.json').write_text(json.dumps(findings, indent=2) + '\n')
patterns = ['downcast_mut', 'with_tag', 'listener!', 'xxh3_64_with_secret', 'xxh3_128_with_secret', 'RsaPrivateKey', 'decrypt(', 'http3', 'ZipArchive', 'ZipStreamReader']
hits = []
for package in inventory:
    crate_root = pathlib.Path(external[(package['name'], package['version'])]['manifest_path']).parent
    for file in crate_root.rglob('*.rs'):
        for number, line in enumerate(file.read_text(errors='replace').splitlines(), 1):
            if any(pattern in line for pattern in patterns):
                hits.append(dict(crate=f"{package['name']}@{package['version']}", file=str(file.relative_to(crate_root)), line=number, text=line.strip()[:240]))
(report / 'function-hits.json').write_text(json.dumps(hits, indent=2) + '\n')
# Preserve the pinned publisher/ZIP caller evidence as well as registry-crate hits.
zip_patterns = ['ZipArchive', 'ZipStreamReader', 'publish_tarball', 'extract_publish_manifest_from_packed', 'is_tarball_path', '& 0o777']
zip_hits = []
for file in sorted((source / 'pnpm/crates').rglob('*.rs')):
    for number, line in enumerate(file.read_text(errors='replace').splitlines(), 1):
        if any(pattern in line for pattern in zip_patterns):
            zip_hits.append(dict(file=str(file.relative_to(source)), line=number, text=line.strip()[:240]))
(report / 'zip-publisher-source-hits.json').write_text(json.dumps(zip_hits, indent=2) + '\n')
print(json.dumps(dict(sourceCommit=COMMIT, registryPackages=len(inventory), findings=[dict(name=f['package']['name'], version=f['package']['version'], id=f['advisory']['id']) for f in findings]), indent=2))
