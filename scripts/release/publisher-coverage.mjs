import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// V8 observes the original distribution, without rewriting its executable code.
export function bracesCoverage(source, script, directory) {
  const markers = [...source.matchAll(/^\/\/ ([^\n]+)\n/gm)];
  const modules = markers.flatMap((marker, index) => marker[1].includes('/node_modules/braces/')
    ? [{ name: marker[1].split('/node_modules/').at(-1), start: marker.index,
      end: markers[index + 1]?.index ?? source.length }] : []);
  assert.ok(modules.some(module => module.name === 'braces/lib/parse.js'));
  const entries = readdirSync(directory).filter(file => file.endsWith('.json')).flatMap(file =>
    JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')).result.filter(entry => entry.url === script));
  assert.ok(entries.length, 'Missing CLI V8 coverage');
  const report = modules.map(module => ({ module: module.name, functions: entries.flatMap(entry => entry.functions)
    .filter(fn => fn.ranges[0].startOffset >= module.start && fn.ranges[0].endOffset <= module.end)
    .map(fn => ({ name: fn.functionName, count: fn.ranges[0].count,
      initializer: fn.functionName.includes('/node_modules/braces/') })) }));
  for (const module of report) assert.ok(module.functions.some(fn => fn.initializer), `Incomplete coverage: ${module.module}`);
  return report;
}

export function assertNoBracesCalls(modules) {
  assert.ok(modules.length, 'Missing braces modules');
  for (const module of modules) {
    for (const fn of module.functions) {
      if (!fn.initializer) assert.equal(fn.count, 0, `braces executed: ${module.module} ${fn.name}`);
    }
  }
}
