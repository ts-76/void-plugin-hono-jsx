import { execFileSync } from 'node:child_process';
import { registry } from './gate.mjs';

export function publishDryRun({ npmCli, tarball, distTag, cwd, env }) {
  // Source PRs retain the last released version. npm checks registry version
  // collisions even in dry-run mode; force skips that check for this local
  // packaging exercise only. It must never reach the real stage command.
  const stdout = execFileSync(process.execPath, [npmCli, 'publish', tarball,
    '--dry-run', '--force', '--ignore-scripts', '--json', '--registry', registry,
    '--access', 'public', '--tag', distTag, '--provenance=false'],
  { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(stdout);
}
