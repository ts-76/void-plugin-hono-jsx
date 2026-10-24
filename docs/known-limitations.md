# Known limitations and update policy

The [support policy](release-contract.md) defines the supported baseline.
These limitations apply to the documented configuration; dated checks are linked below.

## Runtime and platform boundaries

| Area | Limitation | Follow-up |
| --- | --- | --- |
| Browser mounting | Pages and islands redraw SSR content. DOM identity and pre-mount input/focus preservation are not guaranteed. | [#102](https://github.com/ts-76/void-plugin-hono-jsx/issues/102) |
| Development | Page/loader edits reload the document and reset local state. | [#101](https://github.com/ts-76/void-plugin-hono-jsx/issues/101) |
| Multipart forms | Success triggers one GET. The destination needs GET support; loaders/deferred can rerun. Cancellation cannot undo writes. | [#100](https://github.com/ts-76/void-plugin-hono-jsx/issues/100) |
| Deferred data | Failed prefetch can resolve to `null`. Grouped projections need explicit types. Deferred islands and static deferred output are unsupported. | [Pages guide](pages.md#deferred-loader-props) |
| SSR streaming | Void delivers deferred results; the adapter does not send Hono replacement HTML. | [#103](https://github.com/ts-76/void-plugin-hono-jsx/issues/103) |
| Markdown | Trusted authored HTML only; no sanitization. Uses document navigation and the documented syntax subset. | [Markdown guide](markdown.md) |
| Production ISR | Path purge enumerates eventually consistent KV keys and can miss recent query variants. Immediate/global invalidation and single-flight regeneration are not guaranteed. | [#58](https://github.com/ts-76/void-plugin-hono-jsx/issues/58), [results](isr-cloudflare-verification.md#query-variant-purge-investigation) |
| Managed Void platform | Not validated. Direct Workers/D1 checks used RC.1 with ISR disabled. | [Workers record](cloudflare-rc1-verification.md) |

### Local rejected-POST connection issue

On macOS with Void 1.1.11/Miniflare, an undefined named action or oversized rejected POST can break a subsequent request on a reused connection.
The root cause is unresolved. Local negative tests use independent connections; that workaround is not a fix.

The RC.1 direct Cloudflare HTTPS checks passed rejected/undefined-action POSTs followed by healthy GETs using normal pooling.
This observation does not cover every environment or a forced single socket.
See the [dated results](cloudflare-rc1-verification.md). Re-test when Void, Miniflare, Vite or rejection handling changes.

## Dependency and publisher boundaries

- **Consumer dependencies:** the reviewed Void/Drizzle tree retains [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). The inspected path uses esbuild transforms, not the affected serve API. Consumers still install the dependency; avoid its serve feature. See the [reassessment](rc-security-assessment.md).
- **Publisher only:** The private npm 11.21.1 runtime uses fixed dependencies resolved within upstream ranges and pinned by archive integrity, lock and complete runtime hashes. Node 24.22.1 and a fresh zero-finding inventory audit are required. Standard upstream npm/pnpm archives were not repaired in place. See the [publisher assessment](pnpm-publisher-assessment.md).
- **Historical scaffold:** Vite Plus 0.1.24 has unaccepted Critical findings and is unsupported. See [scaffold history](scaffold-compatibility.md).

Consumer audits remain nonzero. Report package-entry counts separately from distinct advisories.
New or changed unreviewed findings, incomplete inventories and failed audit services block publication.
Preserve exact advisory/content hashes and execution conditions; do not add transitive security overrides.
Each candidate needs fresh audits, regardless of earlier release results.

## Updating the supported baseline

1. Inspect the upstream release, scaffold defaults, public APIs and dependency graph. New Void minors, Node majors and Hono/Vite majors need an explicit support decision.
2. Refresh root and both active consumer locks. Keep Vite Plus/core aligned. Historical fixtures remain comparison inputs.
3. Check the running Vite hook, helper version and resolved paths using [launcher diagnostics](../packages/hono-pages/README.md#running-vite-and-launcher-diagnostics).
4. Run source/type/unit/browser checks and both complete packed consumers on identical bytes. Check ordinary Pages before installing optional Markdown peers.
5. Review fresh consumer and Linux publisher audits against their exact approved scope.
6. Repeat a dedicated Workers exercise if deployment, migrations, authentication or rejection handling changed. Verify cleanup; never deploy fixture control APIs or placeholder bindings.
7. Update support tables, limitations and release notes. Review final-head and main CI separately, then follow the [release checklist](release-checklist.md).
