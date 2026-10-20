import { statSync } from 'node:fs';
import { resolve, join } from 'node:path';

/** Local authored component resolution, including directory/index imports. */
export function resolveComponent(specifier: string, importerDir: string, extensions: string[]) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(importerDir, specifier);
  const is = (path: string, kind: 'file' | 'directory') => {
    try { const stat = statSync(path); return kind === 'file' ? stat.isFile() : stat.isDirectory(); }
    catch { return false; }
  };
  for (const path of [...extensions.map(extension => base + extension), base]) {
    if (is(path, 'file')) return path;
  }
  if (is(base, 'directory')) {
    for (const extension of extensions) {
      const path = join(base, 'index' + extension);
      if (is(path, 'file')) return path;
    }
  }
  return null;
}
