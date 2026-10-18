/** Establish the document-owned host before Hono serializes any browser classes. */
export function ensureHonoStyleHost() {
  let host = document.getElementById('hono-css');
  if (host && !(host instanceof HTMLStyleElement)) throw new Error('Hono Styles: #hono-css must be a style element.');
  if (!host) {
    host = document.createElement('style');
    host.id = 'hono-css';
  }
  if (host.parentNode !== document.head) {
    document.head.insertBefore(host, document.head.querySelector('link[rel="stylesheet"],style'));
  }
  return host;
}
