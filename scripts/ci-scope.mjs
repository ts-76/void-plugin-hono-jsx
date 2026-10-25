import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Only prose under docs/ can bypass packed browser consumers. Packaged README,
// changelogs, security policy, fixture Markdown and unknown files always run fully.
export function needsFullConsumers(paths, event) {
  return event !== 'pull_request' || !paths.length || paths.some(file =>
    !/^docs\/.*\.md$/.test(file) || /(?:^|\/)(?:dependency-security|releasing|release-please)\.md$/.test(file));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const base = process.env.CI_DIFF_BASE;
  let paths = [];
  if (process.env.CI_EVENT === 'pull_request') {
    if (!/^[0-9a-f]{40}$/.test(base || '') || /^0+$/.test(base)) throw new Error('Missing PR base commit');
    // Include both names of renames, so moving code into docs cannot hide it.
    paths = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', base, 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  }
  const full = needsFullConsumers(paths, process.env.CI_EVENT);
  if (!process.env.GITHUB_OUTPUT) throw new Error('Missing GitHub output file');
  appendFileSync(process.env.GITHUB_OUTPUT, `full=${full}\n`);
  console.log(full ? 'Full source and both packed consumer stacks required.' : 'Documentation-only PR: packed consumers omitted.');
}
