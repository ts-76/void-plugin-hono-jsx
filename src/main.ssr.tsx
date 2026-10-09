import { raw } from 'hono/html';
import { defineRender } from 'void';
import { Counter } from './Counter';

export default defineRender((c, assetTags) => {
  const pathname = new URL(c.req.raw.url).pathname;
  if (pathname !== '/') return new Response('Not found', { status: 404 });
  const initialCount = 0;
  const page = (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Void × Hono JSX PoC</title>
        <link rel="icon" href="data:," />
        {raw(assetTags.css)}{raw(assetTags.preloads)}
      </head>
      <body>
        <main>
          <p class="eyebrow">CUSTOM SSR / HONO JSX</p>
          <h1>Void × Hono JSX</h1>
          <p id="ssr-marker">この文章と初期カウンターはサーバーで描画しました。</p>
          <div id="counter-root" data-initial-count={initialCount}><Counter initialCount={initialCount} /></div>
          <p id="client-status">クライアント起動前</p>
          <p class="note">ブラウザーでは hono/jsx/dom がカウンター領域を描き直します。再読み込みで 0 に戻ります。</p>
        </main>
        {raw(assetTags.body)}
      </body>
    </html>
  );
  return new Response(`<!doctype html>${page.toString()}`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-poc-renderer': 'hono/jsx' },
  });
});
