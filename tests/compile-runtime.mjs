import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
const compiled = new Map();
export async function runtimeModule(file) {
  if (compiled.has(file.href)) return compiled.get(file.href);
  const source = await readFile(file, 'utf8');
  const result = await transformWithOxc(source, file.pathname, { jsx: { runtime: 'automatic', importSource: 'hono/jsx' } });
  const names = [...result.code.matchAll(/from (["'])([^"']+)\1/g)];
  let code = result.code;
  for (const match of names) {
    const destination = match[2].startsWith('.') ? await runtimeModule(new URL(match[2], file)) : import.meta.resolve(match[2]);
    code = code.replace(match[0], 'from ' + JSON.stringify(destination));
  }
  const uri = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  compiled.set(file.href, uri); return uri;
}
