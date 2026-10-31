"""Read-only candidate audit. Never imported by the publisher or upload jobs.

Usage: python3 scripts/release/assess-pnpm12.py <pnpm-source> <report-directory>
Requires Python >=3.11 and Cargo on PATH (or CARGO pointing to it).
Exit 2 means findings remain; it does not grant any acceptance exception.
"""
import collections
import concurrent.futures
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tomllib
import urllib.request

LOCK_SHA256 = "6b0fdea9da5535746e334a1636fe3f47859b4eea9c3e863259ebd68f6a1d0b9c"
SOURCE_COMMIT = "91774e72a04d52ce61db06339696a433d383c764"
SOURCE_TREE = "38382ec64192f548d2231fa937514c533b83ae41"
TARGET = "x86_64-unknown-linux-gnu"


def request(url, data=None):
    payload = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as response:
        return json.load(response)


def shortest_path(graph, root, destination):
    queue, seen = collections.deque([(root, [root])]), {root}
    while queue:
        node, path = queue.popleft()
        if node == destination:
            return [f"{name}@{version}" for name, version in path]
        for child in sorted(graph[node]):
            if child not in seen:
                seen.add(child)
                queue.append((child, path + [child]))
    return None


def git_tree(directory, root=False):
    """Match the complete clean source tree, including modes and symlinks."""
    entries = [p for p in directory.iterdir() if not (root and p.name == ".git")]
    entries.sort(key=lambda p: (p.name + ("/" if p.is_dir() and not p.is_symlink() else "")).encode())
    content = b""
    for path in entries:
        if path.is_symlink():
            data, mode = os.readlink(path).encode(), b"120000"
        elif path.is_dir():
            content += b"40000 " + path.name.encode() + b"\0" + git_tree(path)
            continue
        elif path.is_file():
            data = path.read_bytes()
            mode = b"100755" if path.stat().st_mode & 0o111 else b"100644"
        else:
            raise RuntimeError(f"Non-regular source entry: {path}")
        digest = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).digest()
        content += mode + b" " + path.name.encode() + b"\0" + digest
    return hashlib.sha1(b"tree " + str(len(content)).encode() + b"\0" + content).digest()


def main():
    source, report = [pathlib.Path(arg).resolve() for arg in sys.argv[1:]]
    if git_tree(source, root=True).hex() != SOURCE_TREE:
        raise RuntimeError("Expected the complete clean pnpm 12.15.0 source tree")
    lock_bytes = (source / "Cargo.lock").read_bytes()
    if hashlib.sha256(lock_bytes).hexdigest() != LOCK_SHA256:
        raise RuntimeError("Candidate lock changed: evaluate and pin a new source separately")
    lock = tomllib.loads(lock_bytes.decode())
    registry = {(x["name"], x["version"]) for x in lock["package"]
                if x.get("source", "").startswith("registry+")}
    cargo = os.environ.get("CARGO") or shutil.which("cargo")
    if not cargo:
        raise RuntimeError("Cargo is required to resolve target/feature-specific dependencies")
    report.mkdir(parents=True, exist_ok=True)
    # This resolves/downloads metadata and crate sources, but does not compile
    # crates or execute build scripts. Dev edges and other targets are excluded.
    command = [cargo, "tree", "--locked", "--target", TARGET, "-p", "pnpm-cli",
               "--edges", "normal,build", "--prefix", "depth", "--format", "{p}"]
    result = subprocess.run(command, cwd=source, capture_output=True, text=True, timeout=300)
    (report / "cargo-tree.log").write_text(result.stderr)
    result.check_returncode()
    if (source / "Cargo.lock").read_bytes() != lock_bytes:
        raise RuntimeError("Cargo changed the candidate lock")
    (report / "target-tree.txt").write_text(result.stdout)
    graph, entries, stack = collections.defaultdict(set), set(), []
    for line in result.stdout.splitlines():
        match = re.fullmatch(r"(\d+)([^ ]+) v([^ \n]+)(?: .*)?", line)
        if not match:
            raise RuntimeError(f"Unrecognized Cargo output: {line}")
        depth, node = int(match[1]), (match[2], match[3])
        if depth > len(stack):
            raise RuntimeError("Incomplete Cargo dependency tree")
        entries.add(node)
        if depth:
            graph[stack[depth - 1]].add(node)
        stack = stack[:depth] + [node]
    inventory = [dict(name=n, version=v) for n, v in sorted(entries & registry)]
    raw = json.dumps(inventory, separators=(",", ":")).encode()
    (report / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
    audit = request("https://api.osv.dev/v1/querybatch", dict(queries=[
        dict(package=dict(name=x["name"], ecosystem="crates.io"), version=x["version"])
        for x in inventory]))
    if len(audit.get("results", [])) != len(inventory):
        raise RuntimeError("Incomplete OSV response")
    matches = []
    for package, entry in zip(inventory, audit["results"]):
        if not isinstance(entry, dict) or "error" in entry or not isinstance(entry.get("vulns", []), list):
            raise RuntimeError("Invalid OSV package result")
        if entry.get("next_page_token"):
            raise RuntimeError("OSV pagination requires a complete follow-up audit")
        matches.extend(dict(**package, id=v["id"]) for v in entry.get("vulns", []))
    ids = sorted({x["id"] for x in matches})
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        advisories = dict(zip(ids, executor.map(
            lambda identifier: request("https://api.osv.dev/v1/vulns/" + identifier), ids)))
    for identifier, advisory in advisories.items():
        if advisory.get("id") != identifier or not advisory.get("modified"):
            raise RuntimeError("Incomplete advisory record")
    findings = []
    for match in matches:
        advisory = advisories[match["id"]]
        encoded = json.dumps(advisory, sort_keys=True, separators=(",", ":")).encode()
        findings.append(dict(**match, summary=advisory.get("summary"),
            modified=advisory["modified"], withdrawn=advisory.get("withdrawn"),
            advisorySha256=hashlib.sha256(encoded).hexdigest(),
            paths={root: shortest_path(graph, (root, "0.0.1"), (match["name"], match["version"]))
                   for root in ["pnpm-cli", "pnpm-publish"]}))
    git_packages = [x for x in lock["package"] if x.get("source", "").startswith("git+")
                    and (x["name"], x["version"]) in entries]
    output = dict(version="12.15.0", sourceCommit=SOURCE_COMMIT, sourceTree=SOURCE_TREE, target=TARGET,
        scope="Source normal/build graph, not a linked-binary SBOM or runtime reachability proof",
        cargo=subprocess.check_output([cargo, "--version"], text=True).strip(),
        cargoLockSha256=LOCK_SHA256, registryPackages=len(inventory),
        inventorySha256=hashlib.sha256(raw).hexdigest(), gitPackages=git_packages,
        vendorPatch="vendor/tar (not included in the registry-only OSV query)",
        findings=findings, acceptedFindings=[], status="evaluation-only; not an upload policy")
    (report / "advisories.json").write_text(json.dumps(advisories, indent=2) + "\n")
    (report / "assessment.json").write_text(json.dumps(output, indent=2) + "\n")
    print(f"{len(inventory)} registry packages; {len(findings)} advisory-ID matches; no acceptance granted")
    return 2 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
