import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { version as helperViteVersion, type Logger } from 'vite';

type Manifest = { peerDependencies: Record<string, string>; engines: { node: string } };

// The package manifest is the single source of supported ranges, from source and dist alike.
const manifest: Manifest = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
);

const parse = (value: string) =>
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value)?.slice(1).map(Number);

/** Checks a stable version against the space-separated comparators used in package.json. */
export function satisfies(version: unknown, range: string): boolean {
  const actual = typeof version === 'string' ? parse(version) : undefined;
  if (!actual) return false;
  return range
    .trim()
    .split(/\s+/)
    .every((comparator) => {
      const [, operator = '', value = ''] = /^(>=|<=|>|<|\^|=)?(.*)$/.exec(comparator) ?? [];
      const target = parse(value);
      if (!target) return false;
      const order = actual[0] - target[0] || actual[1] - target[1] || actual[2] - target[2];
      if (operator === '>=') return order >= 0;
      if (operator === '>') return order > 0;
      if (operator === '<=') return order <= 0;
      if (operator === '<') return order < 0;
      if (operator === '^')
        return order >= 0 && actual[0] === target[0] && (target[0] > 0 || actual[1] === target[1]);
      return order === 0;
    });
}

// Package metadata is not always exported, so walk up from the resolved entry.
function installedVersion(name: string): string | undefined {
  try {
    let directory = dirname(createRequire(import.meta.url).resolve(name));
    while (true) {
      const path = join(directory, 'package.json');
      if (existsSync(path)) {
        const metadata = JSON.parse(readFileSync(path, 'utf8'));
        if (metadata.name === name) return metadata.version;
      }
      if (dirname(directory) === directory) return undefined;
      directory = dirname(directory);
    }
  } catch {
    return undefined;
  }
}

/** Describes every running or installed version outside the declared ranges. */
export function unsupportedVersions({
  viteVersion,
  nodeVersion = process.versions.node,
  installed = installedVersion,
}: {
  viteVersion: unknown;
  nodeVersion?: string;
  installed?: (name: string) => string | undefined;
}): string[] {
  const { peerDependencies: peers, engines } = manifest;
  const messages: string[] = [];
  const check = (label: string, version: unknown, range: string, hint = '') => {
    if (!satisfies(version, range))
      messages.push(
        `Hono Pages: ${label} ${typeof version === 'string' ? version : 'unknown'} is outside the supported range ${range}; it may not work.${hint}`,
      );
  };
  check('Node', nodeVersion, engines.node);
  check(
    'running Vite',
    viteVersion,
    peers.vite,
    ' The launcher that runs Vite, such as vp, decides this version.',
  );
  check('adapter Vite', helperViteVersion, peers.vite);
  for (const name of ['void', 'hono']) {
    const version = installed(name);
    if (version !== undefined) check(name, version, peers[name]);
  }
  return messages;
}

const warned = new Set<string>();

/** Warns once per message; peerDependencies remain the authoritative support statement. */
export function warnUnsupportedVersions(logger: Logger, viteVersion: unknown) {
  for (const message of unsupportedVersions({ viteVersion })) {
    if (warned.has(message)) continue;
    warned.add(message);
    logger.warn(message);
  }
}
