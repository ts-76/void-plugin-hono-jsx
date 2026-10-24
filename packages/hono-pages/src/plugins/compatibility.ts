import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { version as helperViteVersion } from 'vite';

export const supportedFrameworkRanges = {
  void: '>=1.2.1 <1.3.0',
  hono: '>=4.13.13 <5.0.0',
  vite: '>=8.0.16 <9.0.0',
};
export const supportedViteRange = supportedFrameworkRanges.vite;
export const supportedNodeRange = '>=24.21.0 <25.0.0';
export function supportsNode(version: unknown): boolean {
  if (typeof version !== 'string') return false;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  return !!match && match[1] === '24' && Number.isSafeInteger(Number(match[2])) && Number.isSafeInteger(Number(match[3])) && Number(match[2]) >= 21;
}

// Only stable releases are admitted. Void minors are validated explicitly
// because the adapter also uses its virtual-module integration contracts.
export function supportsFramework(name: keyof typeof supportedFrameworkRanges, version: unknown): boolean {
  if (typeof version !== 'string') return false;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return false;
  if (name === 'void') return major === 1 && minor === 2 && patch >= 1;
  if (name === 'hono') return major === 4 && (minor > 13 || (minor === 13 && patch >= 13));
  return major === 8 && (minor > 0 || patch >= 16);
}
export const supportsVite = (version: unknown): boolean => supportsFramework('vite', version);

type PackageInfo = { version: string; path: string };
function packageInfo(name: string, require: NodeRequire): PackageInfo {
  let directory = dirname(require.resolve(name));
  while (true) {
    const path = join(directory, 'package.json');
    if (existsSync(path)) {
      const metadata: unknown = JSON.parse(readFileSync(path, 'utf8'));
      if (typeof metadata === 'object' && metadata !== null && 'name' in metadata && (metadata.name === name || (name === 'vite' && metadata.name === '@voidzero-dev/vite-plus-core'))) {
        if (!('version' in metadata) || typeof metadata.version !== 'string') throw new Error(`Hono Pages: ${name} package version is missing (${path}).`);
        return { version: metadata.version, path };
      }
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Hono Pages: cannot locate ${name} package metadata from ${require.resolve(name)}.`);
    directory = parent;
  }
}
function describe(name: string, require: NodeRequire): string {
  try { const info = packageInfo(name, require); return `${info.path} (metadata ${info.version})`; }
  catch { return `not resolved from ${require.resolve.paths(name)?.join(', ') ?? 'this context'}`; }
}

export function assertSupportedFrameworks({ root, viteVersion }: { root: string; viteVersion: unknown }) {
  if (!supportsNode(process.versions.node)) throw new Error(`Hono Pages: Node ${process.versions.node} is unsupported; expected ${supportedNodeRange}. Use Node 24 LTS from your project root.`);
  const adapter = createRequire(import.meta.url);
  const project = createRequire(join(root, 'package.json'));
  const diagnostic = () => `Running Vite from hook context: ${typeof viteVersion === 'string' ? viteVersion : 'unavailable'}. Adapter helper Vite: ${helperViteVersion}; package.json: ${describe('vite', adapter)}. Project Vite package.json: ${describe('vite', project)}. Package paths are diagnostics, not the running Vite identity.`;
  if (!supportsVite(viteVersion)) {
    throw new Error(`Hono Pages: running Vite ${typeof viteVersion === 'string' ? viteVersion : 'unavailable'} is unsupported; expected ${supportedViteRange}. ${diagnostic()} Update the CLI/launcher that executes Vite. For bundled launchers such as vp, installing project vite alone does not update the running Vite. For standard Vite, install vite@^8.3.4 and run vite directly.`);
  }
  if (!supportsVite(helperViteVersion)) {
    throw new Error(`Hono Pages: adapter helper Vite ${helperViteVersion} is unsupported; expected ${supportedViteRange}. ${diagnostic()} Inspect the adapter's resolved peer copy; install vite@^8.3.4 and refresh the adapter's peer resolution/lockfile if a stale copy remains.`);
  }
  for (const name of ['void', 'hono'] as const) {
    const expected = supportedFrameworkRanges[name];
    const info = packageInfo(name, adapter);
    if (!supportsFramework(name, info.version)) throw new Error(`Hono Pages: ${name} ${info.version} is unsupported; install ${name}@"${expected}". Resolved package.json: ${info.path}. Project package.json: ${describe(name, project)}. ${diagnostic()}`);
  }
}
