# ISR

Local consumer checks and a [direct Workers exercise with 0.2.0](isr-cloudflare-verification.md) are recorded separately. Query-variant path purge failed the production check; follow [Issue #58](https://github.com/ts-76/void-plugin-hono-jsx/issues/58).

The adapter reuses Void's generated worker and `@void/isr/runtime` without adding a cache. The packed-consumer check builds `fixtures/isr` and runs Void production preview with local KV and Cache API storage. No Cloudflare account or provisioning is needed for this test.

## Configuration

For server output, configure a global TTL in `void.config.ts`:

```ts
import { defineConfig } from 'void/config';
export default defineConfig({ routing: { revalidate: 60 } });
```

A companion server module can override it:

```ts
// pages/index.server.ts
import { defineHandler } from 'void';
export const revalidate = 1;
export const loader = defineHandler(() => ({ version: currentVersion() }));
```

Use `revalidate = 0` for a live page. Void also supports path rules and `routing.isr = false` to disable ISR across the app. Per-page settings take precedence over the global/path policy; a response's `x-revalidate` header can override the resolved TTL. These are Void policies, not adapter options. See the [official revalidation guide](https://void.cloud/guide/edge/revalidation).

The fixture's all-zero KV ID is a placeholder for local validation only. Do not use it as a production resource ID or deploy the test control API. Production requires the cache bindings provided by Void's deployment flow. The test's mutable in-memory values and deliberate failure are synthetic controls, not an application datastore.

## Observed local behavior

The first document request is `MISS` and increments the root loader count once. A subsequent `HIT` returns the same safely serialized props without another loader call. After the root's one-second TTL, `STALE` returns the previous HTML while regeneration runs. The next fresh response contains the changed loader version; the root has rendered twice.

The `/global` page still returns its original value with one loader call because it inherits the 60-second policy. `/live` renders on every request because its page export is zero. This verifies the per-page override independently of the global default.

A controlled regeneration error retains the prior valid HTML. Once the loader succeeds, regeneration updates the cache. The test verifies the embedded JSON round trip, escaped hostile text, available production assets and counter interaction after the regenerated page mounts. It does not replace framework error semantics with an adapter fallback.

Run `npm run check:consumer` to repeat these checks. The test starts and stops its own local preview and uses an isolated consumer/cache directory.

## Cache boundary and limitations

Void separates document HTML and Pages JSON caches. A cold JSON request renders live; an HTML render populates both variants. The production exercise checked TTL, privacy, failures, concurrency and deployment lifecycle. It also found a query-variant path purge failure; see the [dated observations](isr-cloudflare-verification.md).

Cache public loader data only. Requests with Cookie, Authorization or Cf-Access-Jwt-Assertion bypass ISR. Responses marked private/no-store/no-cache, Set-Cookie or unsupported Vary opt out. These synthetic checks do not validate an application's authentication provider.

Do not treat a public-to-private change or purge as immediate revocation. Stale public content can remain during regeneration. Cache API deletion is local to the invoked data center, KV propagation is eventual, and concurrent regeneration is not deduplicated. Immediate/global invalidation remains outside the guarantee.

Static output uses build-generated files and static page-data navigation; ISR needs a running worker and cache storage. The managed Void platform remains unverified.
