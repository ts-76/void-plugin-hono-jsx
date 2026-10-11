# Known dependency advisory for the initial alpha

On 2026-10-11, the maintainer accepted the remaining upstream esbuild advisory as a known limitation for preparing `void-plugin-hono-jsx@0.1.0-alpha.0` on `next`, without adding dependency overrides. This records acceptance of one advisory on the pinned peer baseline, not approval to upload, publish, disclose Git history or change repository visibility.

## Finding and dependency path

The root and locked-consumer audits report five Moderate package entries from one distinct advisory, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). The affected leaf is esbuild 0.18.20:

```text
void@0.26.1
└─ drizzle-kit@0.31.11
   └─ @esbuild-kit/esm-loader@2.6.5
      └─ @esbuild-kit/core-utils@3.3.2
         └─ esbuild@0.18.20
```

The five entries are `void`, `drizzle-kit`, `@esbuild-kit/esm-loader`, `@esbuild-kit/core-utils` and `esbuild`; they do not represent five distinct vulnerabilities. esbuild versions through 0.24.2 are affected, and 0.25.0 contains the advisory's fix.

The adapter archive ships no dependency implementation and has no direct esbuild dependency. Consumers still install the exact Void/Hono/Vite peers and their transitive dependencies. The archive's small dependency surface does not remove the consumer finding.

## Observed use and limits of the assessment

- `packages/hono-pages/src/plugins/hono-jsx.ts` uses Vite's `transformWithOxc` for JSX. `scripts/build-package.mjs` uses TypeScript's `tsc` to generate the package output.
- The installed `@esbuild-kit/core-utils/dist/index.js` uses esbuild's `transform` and `transformSync`; its ESM loader supplies TypeScript module loading. No esbuild `serve` invocation was found in the adapter or these loader modules.
- Void's installed DB/init/deploy tooling resolves Drizzle's CLI. That dependency belongs to the upstream framework; this adapter does not control its installation or every execution path.
- The advisory concerns esbuild's own development server allowing other websites to read responses through permissive CORS. The observed transform calls do not start that server. This is limited source inspection, not proof that every Void command or every consumer configuration is unreachable or safe.

Do not use the affected esbuild version's own serve feature. Reassess if a consumer adds it, a peer baseline changes, an upstream fix becomes available, or a new advisory appears. Development/preview checks validate the documented adapter behavior, not all upstream DB commands or managed production environments. The audit remains nonzero.

## Release policy

`release-policy.json` sets `dependencySecurityApproved: true` and lists only the exact GHSA URL in `approvedDependencyAdvisories`. Root and locked-consumer audits still run and are hashed into each candidate's evidence. A new advisory URL in either report continues to block the release plan. Changing framework peers requires another complete consumer run and a renewed assessment of this acceptance.

No override, forced transitive upgrade, dependency deletion or downgrade to npm audit's suggested Void 0.1.6 is part of this decision. Follow a compatible Void/Drizzle upstream fix instead. Include the limitation in the packed README and release notes so npm consumers receive it.

Publisher tooling is assessed separately. This acceptance does not cover the npm CLI's bundled dependency findings or relax the stage job's Moderate-or-higher publisher audit gate. Publication flags, owner/2FA, protected-environment review and history-disclosure requirements remain unchanged.
