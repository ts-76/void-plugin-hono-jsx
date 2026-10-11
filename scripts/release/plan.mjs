import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createPlan } from './gate.mjs';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim()) throw new Error('Release source must remain clean');
const plan = createPlan({ commit, ref: process.env.GITHUB_REF || 'refs/heads/main', artifactRoot: process.env.RELEASE_ARTIFACT_ROOT });
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/release-plan.json', JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify(plan, null, 2));
