# Hono Markdown

Markdown module compiler, request-time article renderer and browser island runtime, independent of Void and deck/document route conventions. The Void adapter and deck host consume this package through their own adapters.

Use `/compiler` for readMarkdownModule / compileMarkdownModule (or the strict static API), the root export for the shared MarkdownContext and hooks, and `/client` for hydrateMarkdownIslands. The Markdown parser and container peers are used by article rendering and compilation; YAML and Shiki are needed only for the corresponding module/highlighting features. No Void or Vite peer is required.

The browser scheduler supports load, idle, visible and media. Hosts may inject a scheduler and a `ready(element, start)` gate for visible islands. Routing, document/head ownership and presentation activation belong to host adapters. The compiler preserves literal attribute restrictions and rejects arbitrary scripts in standalone modules.

## Article content

Use `@ts-76/hono-markdown/render` for CMS article text or other content that must
not become an executable module. For Cloudflare Workers, use the explicit
`@ts-76/hono-markdown/render/worker` entry described below. Neither article entry extracts YAML frontmatter,
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
Reuse `createMarkdownRenderer()` for repeated rendering; the Node entry also shares a lazy Shiki
instance. Heading numbering and duplicate detection reset for every document,
including concurrent calls. Custom heading IDs are escaped, validated and given
suffixes when they collide with another heading or an authored HTML ID.
Article headings use a `user-content-` prefix by default to reduce collisions
with application DOM names. A custom `headingId` owns its prefix; use the returned
`headings[].slug` when building a table of contents.

Install `markdown-exit` and `markdown-it-container` for this entry; YAML is not
needed for article rendering. Fences use escaped `<pre><code>` by default and
do not load Shiki or add copy controls. Set `highlight: true` and install the
optional `shiki` / `@shikijs/transformers` peers for highlighted output. The
default highlighted markup uses the existing theme and copy controls:
`needsCodeCopy` indicates whether the host should include `markdownCopyCode`
from `/copy` in its client entry. A custom `renderCodeBlock` owns its markup and
client behavior; it receives escaped HTML, the original code, language and info
string, and can return a string or Promise. Indented code also reaches this
callback, as unhighlighted text.

## Options and trust boundaries

| Option | Article `/render` default | Trusted `/parser` and `/compiler` default |
| --- | --- | --- |
| `html` | `false` (escape authored HTML) | `true` (preserve authored HTML) |
| `breaks` | `false` | `false` |
| `linkify` | `true` | `true` |
| `headingId` | Text-based unique IDs with `user-content-` prefix | Text-based unique IDs |
| `highlight` | `false` | `true` |
| `renderCodeBlock` | Ordinary escaped code | Theme markup and copy controls |
| `shiki.themes` | Used with `highlight: true` | `github-light` / `github-dark` |

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

## Cloudflare Workers and CMS bodies

`@ts-76/hono-markdown/render/worker` converts article text at request time with
the same HTML/URL defaults, heading metadata, containers, line-break options and
async `renderCodeBlock` callback. It does not require Node compatibility and
does not bundle Node APIs, the module compiler, Babel, YAML, Shiki, Void or Vite.
Install only `@ts-76/hono-markdown`, `hono`, `markdown-exit` and
`markdown-it-container` for this use case.

```ts
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMarkdownRenderer } from '@ts-76/hono-markdown/render/worker';

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

Bundlers using the `workerd` or `worker` export condition also select this
implementation for the existing `/render` import. Use `/render/worker` when the
bundler's export conditions are unknown; it always selects the portable entry.
Node's default `/render` export keeps its existing optional Shiki behavior.

The Worker entry defaults to escaped plain code. Built-in `highlight: true` is
Node/build-time only and is rejected explicitly by the Worker entry. For
request-time highlighting, provide an application-owned `renderCodeBlock`
callback and choose a Worker-compatible highlighter with the languages/themes
your application needs. The library does not pull the full optional Shiki
dependency graph into the Worker. `/parser`, `/compiler`, `/features`,
`/components` and `/resolve-component` remain build-time APIs.

CI tests a packed, minimal consumer in workerd with both [Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
flags disabled, a local CMS service binding, parallel requests and hostile
article inputs. It also checks the Worker dependency graph and TypeScript
declarations without Node types. This does not replace validating the target
site's articles, CSS and application-specific CMS behavior before removing Marked.

This API covers article rendering and the documented Hono Markdown syntax. It
does not implement Marked's tokenizer/extension ecosystem or promise identical
HTML for every Markdown input. Validate the site's existing article fixtures
and CSS before replacing its renderer.
