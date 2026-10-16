import { statSync } from 'node:fs';
import { resolveSpecifier } from 'void/pages-islands-plugin';

/** Relative component imports also use Vite's directory/index convention. */
export function resolveComponent(specifier: string, importerDir: string, extensions: string[]) {
  const target = resolveSpecifier(specifier, importerDir, extensions);
  if (!target) return null;
  if (statSync(target).isFile()) return target;
  if (!statSync(target).isDirectory()) return null;
  const index = resolveSpecifier('./index', target, extensions);
  return index && statSync(index).isFile() ? index : null;
}
