import { timingSafeEqual } from 'node:crypto';
export async function acceptsControlKey(header: string | undefined, digest: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(digest) || !header?.startsWith('Bearer ') || header.length > 150) return false;
  const candidate = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(header.slice(7)));
  return timingSafeEqual(new Uint8Array(candidate), Buffer.from(digest, 'hex'));
}
