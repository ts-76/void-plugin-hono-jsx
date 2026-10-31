"""Evaluation only: run pinned pnpm 12 binaries against a fake loopback registry.

No credentials are inherited. macOS requires sandbox-exec; Linux requires a
fresh network namespace (the probe enables loopback). This is not an
upload runner and does not establish successful production provenance signing.
"""
import base64
import hashlib
import http.server
import io
import json
import os
import pathlib
import platform
import subprocess
import sys
import tarfile
import tempfile
import threading
import urllib.parse

PINS = {
    "Darwin": "d9c23be5ad12e3e31faf6bdbe8c1566f642eddd03d915bfc0b9ab46120c8a521",
    "Linux": "8cca52dc2aab0081ac153a3c7ad36224cd72b6d7cfea413746b7b97f6a3d8942",
}
SANDBOX = ('(version 1)(allow default)(deny network*)'
           '(allow network-outbound (remote ip "localhost:*"))')


def main():
    cli, destination = [pathlib.Path(arg).resolve() for arg in sys.argv[1:]]
    system = platform.system()
    if system not in PINS or hashlib.sha256(cli.read_bytes()).hexdigest() != PINS[system]:
        raise RuntimeError("Expected the pinned official pnpm 12.15.0 native binary")
    prefix = []
    if system == "Darwin":
        prefix = ["/usr/bin/sandbox-exec", "-p", SANDBOX]
    else:
        if os.readlink('/proc/self/ns/net') == os.readlink('/proc/1/ns/net'):
            raise RuntimeError("Run inside a fresh Linux network namespace")
        subprocess.run(["ip", "link", "set", "lo", "up"], check=True)
        route = subprocess.run(["ip", "route", "show", "table", "all"],
                               capture_output=True, text=True, check=True).stdout
        if any(" dev " in line and " dev lo " not in line + " " for line in route.splitlines()):
            raise RuntimeError("The namespace must contain loopback routes only")

    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pnpm12-protocol-") as temporary:
        root = pathlib.Path(temporary)
        base_env = dict(PATH="/usr/bin:/bin", HOME=str(root),
                        XDG_CONFIG_HOME=str(root / "config"),
                        XDG_DATA_HOME=str(root / "data"),
                        XDG_CACHE_HOME=str(root / "cache"), PNPM_HOME=str(root / "pnpm-home"))
        # A negative control proves that native code cannot bypass isolation.
        denial = subprocess.run(prefix + [sys.executable, "-c",
            "import socket;s=socket.socket();s.settimeout(2);"
            "s.connect(('192.0.2.1',443))"], env=base_env, cwd=root,
            capture_output=True, text=True, timeout=5)
        expected_denial = ["Operation not permitted"] if system == "Darwin" else ["Network is unreachable", "Operation not permitted"]
        if denial.returncode == 0 or not any(message in denial.stderr for message in expected_denial):
            raise RuntimeError("External network denial control failed")

        records, state = [], {"case": ""}

        class Registry(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def respond(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                records.append(dict(method=self.command, path=self.path,
                    authorization=self.headers.get("Authorization"),
                    body=json.loads(body) if body else None))
                status, response = 200, {}
                if self.path.startswith("/identity"):
                    audience = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)["audience"][0]
                    payload = dict(repository_visibility="public", aud=audience, sub="fixture")
                    jwt = "e30." + base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=") + ".fixture"
                    response = dict(value="invalid-sigstore-token" if audience == "sigstore" else jwt)
                elif "/oidc/token/exchange/" in self.path:
                    response = {} if state["case"] == "oidc-missing-token" else dict(token="fixture-token")
                elif self.path.startswith("/-/stage/package/"):
                    status = 500 if state["case"] == "stage-500" else 401 if state["case"] in ["oidc-missing-token", "malformed-oidc"] else 201
                    response = dict(stageId="00000000-0000-4000-8000-000000000001") if status == 201 else dict(error="fixture-rejection")
                elif self.path.startswith("/-/package/"):
                    response = dict(public=True)
                else:
                    status, response = 404, dict(error="not found")
                raw = b"{" if state["case"] == "malformed-oidc" and "/oidc/token/exchange/" in self.path else json.dumps(response).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            do_GET = respond
            do_POST = respond
            do_PUT = respond

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Registry)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        registry = f"http://127.0.0.1:{server.server_port}/"
        marker = root / "unexpected-lifecycle"
        name, version = "pnpm12-evaluation-fixture", "0.0.0"
        manifest = dict(name=name, version=version, license="MIT",
            scripts={key: f"touch {marker}" for key in ["prepublishOnly", "prepare", "publish", "postpublish"]})
        tarball = root / "fixed.tgz"
        with tarfile.open(tarball, "w:gz") as archive:
            for path, raw in [("package/package.json", json.dumps(manifest).encode()),
                              ("package/README.md", b"Controlled fixture")]:
                entry = tarfile.TarInfo(path)
                entry.size = len(raw)
                archive.addfile(entry, io.BytesIO(raw))
        data = tarball.read_bytes()
        integrity = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
        outcomes = []
        try:
            for case in ["fixed-tarball", "silent-json", "oidc-missing-token", "signing-failure", "stage-500", "dry-run", "malformed-oidc"]:
                state["case"] = case
                records.clear()
                cwd = root / case
                cwd.mkdir()
                auth = cwd / "user.npmrc"
                auth.write_text("")
                env = dict(base_env, HOME=str(cwd), CI="true", NO_COLOR="1",
                    NPM_CONFIG_USERCONFIG=str(auth), NPM_CONFIG_GLOBALCONFIG=str(cwd / "global.npmrc"),
                    GITHUB_ACTIONS="true", ACTIONS_ID_TOKEN_REQUEST_URL=registry + "identity?fixture=1",
                    ACTIONS_ID_TOKEN_REQUEST_TOKEN="fixture-request", GITHUB_SERVER_URL="https://github.com",
                    GITHUB_REPOSITORY="fixture/repo", GITHUB_SHA="fixture-commit",
                    GITHUB_WORKFLOW_REF="fixture/repo/.github/workflows/evaluation.yml@refs/tags/fixture",
                    GITHUB_REF="refs/tags/fixture", GITHUB_EVENT_NAME="workflow_dispatch",
                    GITHUB_RUN_ID="fixture-run", GITHUB_RUN_ATTEMPT="1", RUNNER_ENVIRONMENT="github-hosted")
                args = [str(cli), "stage", "publish", str(tarball), "--ignore-scripts",
                    "--no-git-checks", "--json", "--registry", registry, "--tag", "next", "--access", "public",
                    "--provenance" if case == "signing-failure" else "--no-provenance"]
                if case == "dry-run":
                    args.append("--dry-run")
                if case == "silent-json":
                    args.append("--reporter=silent")
                result = subprocess.run(prefix + args, env=env, cwd=cwd,
                    capture_output=True, text=True, timeout=25)
                posts = [r for r in records if r["path"].startswith("/-/stage/package/")]
                outcome = dict(case=case, exitCode=result.returncode, stdout=result.stdout,
                    stderr=result.stderr, requests=list(records), stagePosts=len(posts))
                outcomes.append(outcome)
                # Save partial evidence even if an assertion rejects the candidate.
                report = dict(version="12.15.0", binarySha256=PINS[system], platform=platform.platform(),
                    isolation="macOS sandbox-exec loopback only" if system == "Darwin" else "Linux network namespace",
                    externalNetworkDenied=True, signing="Failure only; successful signing is unverified",
                    fixtureSha256=hashlib.sha256(data).hexdigest(), cases=outcomes)
                (destination / "protocol.json").write_text(json.dumps(report, indent=2) + "\n")
                assert not marker.exists(), "Lifecycle script ran"
                assert not any(r["method"] == "PUT" for r in records), "Direct publication attempted"
                if case in ["fixed-tarball", "silent-json"]:
                    assert result.returncode == 0 and len(posts) == 1, outcome
                    # pnpm 12.15.0 emits progress before its final --json object.
                    # Record that behavior; a production receipt parser must
                    # explicitly handle it or select a verified silent reporter.
                    start = result.stdout.index("{\n")
                    outcome["jsonOnlyStdout"] = not result.stdout[:start].strip()
                    receipt = json.loads(result.stdout[start:])[name]
                    assert receipt["integrity"] == integrity and receipt["stageId"], outcome
                    doc = posts[0]["body"]
                    assert posts[0]["authorization"] == "Bearer fixture-token", outcome
                    assert doc["dist-tags"] == {"next": version} and doc["access"] == "public", outcome
                    assert base64.b64decode(doc["_attachments"][f"{name}-{version}.tgz"]["data"]) == data, outcome
                    if case == "silent-json":
                        assert outcome["jsonOnlyStdout"], outcome
                elif case in ["signing-failure", "dry-run"]:
                    assert not posts and (result.returncode == 0) == (case == "dry-run"), outcome
                    if case == "signing-failure":
                        assert any("audience=sigstore" in r["path"] for r in records), outcome
                elif case == "stage-500":
                    assert result.returncode != 0 and len(posts) == 1, outcome
                else:
                    # Record CLI auth fallback as an integration hazard, not approval.
                    assert result.returncode != 0 and len(posts) <= 1, outcome
                    assert all(r["authorization"] is None for r in posts), outcome
                print(f"{case}: exit={result.returncode}, stage POSTs={len(posts)}", flush=True)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
