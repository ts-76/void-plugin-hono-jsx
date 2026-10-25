# Hono Markdown

Markdown module compiler, request-time article renderer and browser island runtime, independent of Void and deck/document route conventions. The Void adapter and deck host consume this package through their own adapters.

Use `/compiler` for readMarkdownModule / compileMarkdownModule (or the strict static API), the root export for the shared MarkdownContext and hooks, and `/client` for hydrateMarkdownIslands. The Markdown parser and container peers are used by article rendering and compilation; YAML and Shiki are needed only for the corresponding module/highlighting features. No Void or Vite peer is required.

Module compilation reuses one parser and lazy Shiki highlighter per `options` object. Pass the same object for every document in a build, and do not mutate it after the first call.

The browser scheduler supports load, idle, visible and media. Hosts may inject a scheduler and a `ready(element, start)` gate for visible islands. Routing, document/head ownership and presentation activation belong to host adapters. The compiler preserves literal attribute restrictions and rejects arbitrary scripts in standalone modules.

`hydrateMarkdownIslands` returns a function that cancels islands that have not started mounting; custom schedulers may return their own cleanup. Load and mount failures are passed to `reportError` (or `console.error`), mark the element with `data-hono-md-error` and leave it retryable by a later call.

Module compilation serializes one island context per document on its `.void-md` wrapper. That context includes frontmatter, which therefore appears in the HTML. Set `clientFrontmatter` to an array of keys, or to `false`, to limit what islands receive. The default `true` keeps every key. The module's `frontmatter` export and server rendering outside islands keep the full mapping. Islands see the same subset during SSR and hydration.

## Article content

Use `@ts-76/hono-markdown/render` for CMS article text or other content that must
not become an executable module. This single entry runs in Cloudflare Workers
and Node with the same implementation and options, without special bundler
conditions or Node compatibility flags. It does not extract YAML frontmatter,
interpret a leading `<script>`, resolve component imports, or emit client code.
Raw HTML is escaped by default, including HTML in container titles. Markdown
links and images allow relative/fragment URLs and `http`, `https`, `mailto` and
`tel` schemes; executable, data and unknown schemes are rejected.

```ts
import { createMarkdownRenderer } from '@ts-76/hono-markdown/render';

const articles = createMarkdownRenderer({
  breaks: true,
  headingId: ({ index }) => `post-section-${index + 1}`,
  renderCodeBlock: ({ html }) => `<figure class="article-code">${html}</figure>`,
});
const { html, headings } = await articles.render(articleBody);
// headings[].slug matches the actual heading id in html.
// In a Hono request handler: return c.html(html).
```

`renderMarkdown(source, options)` provides the same behavior for a single call.
Reuse `createMarkdownRenderer()` for repeated rendering. Heading numbering and duplicate detection reset for every document,
including concurrent calls. Custom heading IDs are escaped, validated and given
suffixes when they collide with another heading or an authored HTML ID.
Article headings use a `user-content-` prefix by default to reduce collisions
with application DOM names. A custom `headingId` owns its prefix; use the returned
`headings[].slug` when building a table of contents.

Install `markdown-exit` and `markdown-it-container` for this entry; YAML is not
needed for article rendering. Fences use escaped `<pre><code>` by default and
do not load Shiki or add copy controls. For syntax highlighting, provide
`renderCodeBlock` and choose a highlighter supported by your runtime. The callback
receives escaped HTML, the original code, language and info string, and can return
a string or Promise. Indented code also reaches it as language `text`.
`needsCodeCopy` is always `false` for articles; the application owns custom markup,
CSS and any copy behavior. Built-in Shiki and copy controls remain available for
trusted modules through `/compiler`.

## Options and trust boundaries

| Option | Article `/render` default | Trusted `/parser` and `/compiler` default |
| --- | --- | --- |
| `html` | `false` (escape authored HTML) | `true` (preserve authored HTML) |
| `breaks` | `false` | `false` |
| `linkify` | `true` | `true` |
| `headingId` | Text-based unique IDs with `user-content-` prefix | Text-based unique IDs |
| `highlight` | Not an article option | `true` |
| `renderCodeBlock` | Ordinary escaped code | Theme markup and copy controls |
| `shiki.themes` | Not an article option | `github-light` / `github-dark` |

`html: true` is an explicit opt-in for trusted HTML. It does **not** sanitize
scripts, event attributes or URLs inside that HTML. An application that needs
selected HTML from untrusted authors must sanitize the final output with its own
policy. `renderCodeBlock` is trusted application code: reuse its escaped `html`
field or escape `code`, `language` and `info` before placing them in HTML. Its
return value is not sanitized. Rendering does not prevent remote image tracking
or replace application-level content/size limits.

Keep using `/compiler` for authored `.md` modules with components, frontmatter
and islands. Its existing HTML, script-prelude and generated-module contracts
are unchanged; **never pass untrusted CMS content to that API**, even with
`html: false`. The Void adapter accepts the shared display options, but its page
compiler remains a trusted-source compiler. The common module compiler omits
default copy code when highlighting is disabled or custom code markup is used.
Void adapters must consume `needsCodeCopy` for the same omission; older adapters
continue loading their default copy client.

Component attributes are literal data. Static component attributes reject every
`on*` name and renderer-owned props. Island props reject renderer-owned props
(`children`, `key`, `ref`, `dangerouslySetInnerHTML`), names with `on` followed by an
uppercase letter, and known HTML event attributes in any case. Other keys, such as
`onboarding`, remain data.

## Cloudflare Workers and CMS bodies

`@ts-76/hono-markdown/render` converts article text at request time with
the same HTML/URL defaults, heading metadata, containers, line-break options and
async `renderCodeBlock` callback. It does not require Node compatibility and
does not bundle Node APIs, the module compiler, Babel, YAML, Shiki, Void or Vite.
Install only `@ts-76/hono-markdown`, `hono`, `markdown-exit` and
`markdown-it-container` for this use case.
`@babel/parser` is still installed as a regular dependency because the module
compiler needs it and the Void adapter ships `@ts-76/hono-markdown` as its only
dependency; article and browser entries never import or bundle it. Only the CSS
exports are marked as side effects.

```ts
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMarkdownRenderer } from '@ts-76/hono-markdown/render';

const articles = createMarkdownRenderer({
  breaks: true,
  headingId: ({ index }) => `post-section-${index + 1}`,
  renderCodeBlock: ({ html }) => `<figure class="article-code">${html}</figure>`,
});
const app = new Hono();
app.use('/render', bodyLimit({ maxSize: 128 * 1024 }));
app.post('/render', async c => {
  const { html } = await articles.render(await c.req.text());
  return c.html(html);
});
export default app;
```

In a CMS-backed handler, pass the fetched article body to `articles.render()`
and use the returned `headings` for the table of contents. The application owns
CMS authentication, fetch errors, body/response size limits and article CSS.
The renderer can be shared across requests: per-article heading IDs and link
references are isolated, including concurrent asynchronous rendering.

The `/render` export always uses the portable renderer. No conditional export or
Node-only implementation is selected. Use `renderCodeBlock` for application-owned
highlighting and select only the languages/themes your Worker needs. `/parser`,
`/compiler`, `/features`, `/components` and `/resolve-component` remain build-time APIs.

CI tests a packed, minimal consumer in workerd with both [Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
flags disabled, a local CMS service binding, parallel requests and hostile
article inputs. It also checks the Worker dependency graph and TypeScript
declarations without Node types. This does not replace validating the target
site's articles, CSS and application-specific CMS behavior before removing Marked.

This API covers article rendering and the documented Hono Markdown syntax. It
does not implement Marked's tokenizer/extension ecosystem or promise identical
HTML for every Markdown input. Validate the site's existing article fixtures
and CSS before replacing its renderer.

## Migrating from 0.1.2

Article rendering now has one portable API. Change imports from `/render/worker`
to `/render`; the former entry is removed. Remove `highlight` and `shiki` from
article options, including `highlight: false` or `undefined`. For highlighted
articles, move the highlighter into `renderCodeBlock`; it receives escaped plain
code in `html`, rather than pre-highlighted markup. These removed options fail
explicitly for JavaScript callers as well as in TypeScript. Use
`MarkdownRenderOptions` for article option types. Module-only `clientFrontmatter`
is also rejected by article rendering.

When using Void, upgrade `void-plugin-hono-jsx` to 0.9.0 or newer together with
this package. Adapter 0.8.x requires the 0.1.x common runtime; installing 0.2.x
alongside it can create two runtime/context instances. All Markdown hosts in one
app must resolve the same common runtime. Hono＋Vite and HonoX deck adapters can
use 0.2.x directly.

Trusted `/compiler` options and Shiki output, client islands and host adapter
configuration are unchanged.
