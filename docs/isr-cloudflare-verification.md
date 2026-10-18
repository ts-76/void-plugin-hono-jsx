# Direct Workers ISR verification

Observed on 2026-10-18 for [Issue #58](https://github.com/ts-76/void-plugin-hono-jsx/issues/58). This is a dated production exercise, not a global cache guarantee. **Query-variant path purge did not pass the bounded check.**

## Environment

| Item | Value |
| --- | --- |
| Public adapter | `void-plugin-hono-jsx@0.2.0` |
| Package tgz SHA256 | `fe94b4a9b35e1e2ee86a44c8d07c52aa512fa4f92f640b55c6d66561456de968` |
| Repository baseline | `4b78e15b3e600b3bd75bd439781e4bf5bf827695` |
| Runtime | Node 24.21.0, Void 1.1.11 / `@void/isr` 1.1.11, Hono 4.13.13, Vite 8.3.4 |
| Deployment | Public `void deploy --platform cloudflare`; dedicated Worker, D1 and ISR KV in the approved tsapp account |
| Bounds | Synthetic data; CPU limit 10 ms; control API key verifier and 2 KiB body limit; no additional paid plan |

The isolated consumer installed the public package. Local type/build checks and the initial local ISR matrix passed before deployment. The later local negative-control check reproduced the known Miniflare reused-connection failure; the runner therefore records these negative POST controls as skipped on loopback. Production HTTPS verified them with normal pooling. Wrangler generated binding/runtime types from the emitted config. The uploaded config contained actual resource IDs, with no local placeholder KV ID.

Node requests reported SJC; Chromium responses included SJC and SEA. No region was deliberately selected. This does not constitute a controlled multi-region test. Raw request headers, credentials, account/resource IDs and expired URLs are excluded from this record.

## Results

| Check | Observation |
| --- | --- |
| HTML and Pages JSON | Cold JSON rendered live (render 1). HTML MISS rendered again (render 2); fresh HTML and JSON HIT reused render 2. Expired HTML returned STALE/version 1, then version 2 after background rendering. |
| Policy | Page/path/header TTL of 4 seconds overrode the 60-second default. Page/header zero rendered current state on every request. |
| Failed regeneration | D1 recorded failed attempts; valid old HTML remained STALE. Clearing the failure allowed new content. |
| Request bypass | Cookie, Authorization and Cf-Access-Jwt-Assertion for synthetic Alice/Bob returned their own HTML/JSON. The warm anonymous cache retained its original anonymous render ID. |
| Response privacy | private, no-store, no-cache, Set-Cookie, Vary: Accept-Language and Vary: * rendered anew. A public-to-private change removed the old shared HTML/JSON after regeneration; old public content was still served during the stale window. |
| Query keys | Allowlisted `kind=a/b` had distinct HTML/JSON. An unlisted-query miss rendered live without storage; a warm normalized key returned its public cached props. |
| Path purge | Failed: after `revalidate({ paths: ['/query'] })`, a recent variant still returned old HIT content. A second isolated check retained `kind=b` version 1 for over 25 seconds, below its 60-second TTL. `kind=a` updated immediately in that check. A later separate purge returned new HTML MISS and matching JSON HIT. |
| Purge all | Both warmed paths changed from version 1 to version 2 with HTML MISS and matching JSON HIT through `revalidate({ all: true })`. |
| Concurrency | Four cold requests caused four D1 render records. Four expired requests all returned STALE and caused four regenerations; content converged to the new version. No single-flight guarantee. |
| Browser | Chromium mounted cached pages, incremented the counter and navigated using Pages JSON. Hostile text stayed inert. JavaScript-disabled SSR rendered correctly. Page errors: zero. |

The path-purge failure is retained as a failure. Passing local tests or the later successful purge does not erase it. Void owns this cache/purge implementation; the adapter adds no independent cache or invalidation path. KV/Cache API timing and concurrent writes are possible factors, but the root cause is not established. Issue #58 remains open for the bounded purge failure and controlled multi-region follow-up.

## Deployment lifecycle and cleanup

The second deployment retained the same Worker, D1 and KV identities and the first revision’s D1 render rows. The build generated a new ISR deployment scope. Old `/redeploy` KV content was still present, but the new deployment returned HTML MISS with revision `second` (render 88), followed by matching HTML/JSON HIT. Browser checks passed again with zero page errors.

The captured Worker tail contained 187 events with outcome `ok` and two deliberate regeneration-error log messages; no other exception messages were observed in that capture. The tail did not cover every request.

Only the dedicated Worker, D1 and KV were deleted. Fresh paginated inventories restored the exact original identifier sets (21 Workers, 6 D1 databases, 14 KV namespaces). The verification URL returned 404 without fixture content through the same Node HTTPS transport. Preview and tail processes were stopped.

## Operating boundary

Cache public data only. Use request bypass and response privacy from the first response; changing public data to private or calling purge is not an immediate revocation mechanism.

Cloudflare's [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) is local to the invoked data center. [KV is eventually consistent](https://developers.cloudflare.com/kv/concepts/how-kv-works/), including cached negative lookups. The observed purge failure must not be described as a proven KV bug or as fixed by the adapter. Global immediate invalidation, distinct hostnames, real identity-provider integration and the managed Void platform remain unverified.

Use the [fixture instructions](../fixtures/isr-cloudflare/README.md) to repeat the exercise. The checker exits nonzero for unmet purge assertions; no cloud resources are created by ordinary consumer CI.
