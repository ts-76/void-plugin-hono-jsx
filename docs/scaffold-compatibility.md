# Void scaffold and current-latest compatibility

These ranges and running-Vite checks shipped in alpha.3; alpha.1/alpha.2 retain the exact-version gate. The following is a versioned fixture snapshot, with registry versions read on 2026-10-12. Void 0.27.0's packaged init source requests Hono `^4.11.9`, Vite `^8.0.10`, TypeScript `^7.0.2`, and (by default) Vite Plus `^0.1.21`. The React choice adds `@void/react`, React/DOM/types and `oxc-transform-react`; Hono JSX replaces that adapter and compiler. [Void quickstart](https://void.cloud/guide/quickstart)

| Locked consumer | Void | Direct `vite` dependency | Launcher / actual hook Vite |
| --- | --- | --- | --- |
| baseline | 0.26.1 | 8.3.3 | vite / 8.3.3 |
| vite-patch | 0.26.1 | 8.3.4 | vite / 8.3.4 |
| latest-vite | 0.27.0 | 8.3.4 | vite / 8.3.4 |
| scaffold-vp | 0.27.0 | 8.3.4 | Vite Plus 0.1.24 / 8.0.16 |
| latest-vp | 0.27.0 | npm:@voidzero-dev/vite-plus-core@1.1.0 | Vite Plus 1.1.0 / 8.3.3 |

Hono 4.13.13 and TypeScript 7.0.2 were the latest versions on that date and are shared by every fixture. The three new-stack fixtures retain the React scaffold dependencies from that snapshot: React/DOM/types 19.3.0, @void/react 0.27.0 and oxc-transform-react 0.153.0. Their presence is tested; converting application React source is still required. Full consumers exercise declarations, dev/build/preview, SSR, browser mounting, counter/nav/reset/reload, concurrent SSR during page/loader changes, route add/remove, deferred HTML/NDJSON, islands, static HTML/JSON and local ISR. Managed deployment remains unverified.

The real config hook context reports `this.meta.viteVersion`; root or adapter-resolved package metadata does not establish host identity. The adapter also validates the actual Vite helper module it imports and identifies adapter/project package metadata paths in errors. Alias metadata identifies the core package, while its exported version identifies the underlying helper Vite. [Vite plugin context](https://vite.dev/guide/api-plugin.html#plugin-context-meta)

Vite Plus 1.1.0 rejects a separate direct vite 8.3.4 before plugin loading. Its fixture uses the official aligned alias and consumer-only overrides (`vite: $vite`, `vitest: 5.0.3`). These settings align Vite and Vitest across the dependency tree, following [Vite Plus upgrade instructions](https://viteplus.dev/guide/upgrade-project) and [manual installation](https://viteplus.dev/guide/local-cli). They are not changes to the adapter's dependencies or vulnerability overrides. Fresh npm ci and tarball install are both required by the consumer check.

## Accepted ranges and future updates

Stable peers are Void >=0.26.1 <0.28.0, Hono >=4.13.13 <5.0.0 and Vite >=8.0.16 <9.0.0. Prereleases fail closed. Patch updates and Hono/Vite minor updates within these ranges do not require a new adapter release solely for an exact-version gate. Void 0.28 or a new Hono/Vite major needs explicit renewed validation because the adapter uses version-specific Void conventions. The ranges express a compatibility policy; the table records versions actually tested. Refresh pinned fixtures and their lockfiles, inspect new scaffold defaults/launcher identities, run full matrix checks, and review audit reports before declaring a future upstream version verified.

## Dependency audit assessment

Audits are nonzero. Current-latest plain Vite and Vite Plus contain six propagated Moderate package entries for the already accepted esbuild advisory, including @void/react's propagation through Void. Removing unused React packages can change that entry count. The scaffold's old Vite Plus adds three propagated Critical entries (`tinypool`, `oxfmt`, `vite-plus`) from two new advisories:

- [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3): worker option lookups can turn previously polluted prototype options into executable worker configuration. Fixed in 2.1.1.
- [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr): a passed run-options object can inherit a polluted filename and select an attacker-controlled worker. Fixed in 2.1.2.

The inspected chain is Vite Plus 0.1.24 → oxfmt 0.52.0 → tinypool 2.1.0. Oxfmt's CLI imports and constructs Tinypool. The compatibility consumer runs vp dev/build/preview, not vp fmt; successful requests do not assess all formatter paths or provide a blanket security claim. No exploit was run and no untrusted project was introduced. Latest Vite Plus removes those findings without a tinypool override, making it preferable to accepting the old scaffold's formatter exposure.

Both tinypool advisories remain absent from approvedDependencyAdvisories. The old scaffold's release-plan artifact reports dependency-advisories-unreviewed; functional CI passing is not approval of that stack's audit findings. Existing stage audit enforcement and security allowlist are unchanged. The default stage consumer remains the original baseline; review all matrix reports before another staging decision. This change adds no Vite Plus dependency to the published adapter and performs no npm stage or approval.
