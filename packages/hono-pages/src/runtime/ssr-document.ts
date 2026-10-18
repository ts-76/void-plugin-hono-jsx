import { jsx } from 'hono/jsx/jsx-runtime';
import type { JSXNode } from 'hono/jsx';
import { Style } from 'hono/css';
import { raw } from 'hono/html';
import { HtmlEscapedCallbackPhase, resolveCallback, type HtmlEscapedString } from 'hono/utils/html';
import { renderHeadToString, renderHtmlAttrs, renderBodyAttrs } from 'void/pages-head';
import { serializePageData } from 'void/pages-server';
import type { PageObject } from 'void/pages-protocol';
import { StyleContext } from './style-context.ts';

type Assets = { css: string; preloads: string; body: string; devCssNonce?: string };

/** Render one complete callback buffer so CSS can fill the head before delivery. */
export async function renderHonoDocument(content: JSXNode, page: PageObject, assets: Assets, attributes: { markdownScript?: string; markdown?: string } = {}) {
  let nonce = assets.devCssNonce;
  let configured = false;
  const validate = (value: unknown) => {
    if (value !== undefined && (typeof value !== 'string' || !/^[A-Za-z0-9+/_=-]+$/.test(value))) throw new Error('Hono Styles: nonce must be a non-empty CSP base64 value.');
  };
  validate(nonce);
  const configure = (input: string | undefined) => {
    const value = input ?? assets.devCssNonce;
    validate(value);
    if (configured && value !== nonce) throw new Error('Hono Styles: one document cannot use different style nonces.');
    nonce = value;
    configured = true;
  };
  // The async boundary preserves callbacks even for otherwise synchronous
  // trees. A second toString() on escaped markup would run the sync resolver.
  const app = await jsx(StyleContext.Provider, { value: configure, children: jsx(async () => jsx('div', { id: 'app', 'data-md-script': attributes.markdownScript, 'data-hono-markdown': attributes.markdown, children: content }), {}) }).toString() as HtmlEscapedString;
  if (String(app).includes('<style id="hono-css"')) throw new Error('Hono Styles: the adapter owns #hono-css; remove hono/css Style from the page or use HonoStyles from void-plugin-hono-jsx/pages for its nonce.');
  const head = page.head;
  const body = page.deferredKeys ? assets.body.replaceAll('<script type="module"', '<script async type="module"') : assets.body;
  const stylesheet = Style({ nonce });
  // String concatenation must retain callbacks from both escaped fragments.
  const document = raw('<!doctype html><html' + (head ? renderHtmlAttrs(head) : '') + '><head>'
    + stylesheet + (head ? renderHeadToString(head) : '') + assets.css + assets.preloads
    + '</head><body' + (head ? renderBodyAttrs(head) : '') + '>'
    + '<script id="__VOID_PAGE_DATA__" type="application/json">' + serializePageData(page) + '</script>'
    + app + body + '</body></html>', [...(stylesheet.callbacks ?? []), ...(app.callbacks ?? [])]);
  // BeforeStream completes CSS callbacks without waiting on server Suspense.
  // Void retains ownership of deferred result delivery and browser rendering.
  return String(await resolveCallback(document, HtmlEscapedCallbackPhase.BeforeStream, false, {}));
}
