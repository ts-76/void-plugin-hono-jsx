import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// npm exits 1 for findings. Network/registry failures still fail preparation.
export function dependencyAudit({ npmCli, cwd, env, output }) {
  let stdout;
  try { stdout = execFileSync(process.execPath, [npmCli, 'audit', '--json'], { cwd, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); }
  catch (error) { if (error.status !== 1 || !error.stdout) throw error; stdout = error.stdout; }
  const report = JSON.parse(stdout);
  assert.ok(!report.error && report.metadata?.vulnerabilities && report.vulnerabilities, 'Dependency audit did not return a complete report');
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Locked dependency audit: ${JSON.stringify(report.metadata.vulnerabilities)}`);
  return report;
}
