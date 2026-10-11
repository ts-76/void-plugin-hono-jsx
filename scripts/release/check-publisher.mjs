import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { auditPublisher, verifyPublisher } from './publisher.mjs';
verifyPublisher(process.env.PNPM_RELEASE_CLI);
const report = await auditPublisher();
writeFileSync(path.join(process.env.RUNNER_TEMP, 'publisher-rust-report', 'publisher-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Publisher: ${report.auditedCrates} crates; ${report.findings.length} scoped accepted findings`);
