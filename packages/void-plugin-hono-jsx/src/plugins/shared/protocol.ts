import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The Pages protocol version of the installed Void, read from its own `@void/edge`.
 * Void 1.7 and later reject Pages requests without it; earlier versions define none.
 * The adapter needs it only for the multipart requests it sends itself.
 */
export async function pagesProtocolVersion(): Promise<string | undefined> {
  try {
    const voidRequire = createRequire(createRequire(import.meta.url).resolve('void'));
    for (const base of voidRequire.resolve.paths('@void/edge') ?? []) {
      const directory = join(base, '@void/edge');
      if (!existsSync(join(directory, 'package.json'))) continue;
      const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
      const entry = metadata.exports?.['.']?.import;
      if (typeof entry !== 'string') return undefined;
      const edge: { PAGES_PROTOCOL_VERSION?: unknown } = await import(
        pathToFileURL(join(directory, entry)).href
      );
      return typeof edge.PAGES_PROTOCOL_VERSION === 'string'
        ? edge.PAGES_PROTOCOL_VERSION
        : undefined;
    }
  } catch {
    // Without a resolvable Void the plugin reports the missing peer elsewhere.
  }
  return undefined;
}
