export const fixture = 'void-hono-isr-cloudflare-check';
export const paths = ['/page', '/global', '/path', '/live', '/header-zero', '/header-ttl', '/boundary', '/query', '/purge', '/all-a', '/all-b', '/concurrent', '/redeploy'] as const;
export const privacyModes = ['public', 'private', 'no-store', 'no-cache', 'set-cookie', 'vary-language', 'vary-star'] as const;
