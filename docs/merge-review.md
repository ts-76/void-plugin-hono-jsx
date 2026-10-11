# Stacked implementation review

Reviewed PRs #14 through #29 in their implementation dependency order. Review found an SSR provider-identity race during development reloads and missing automated source-browser coverage. Both are corrected in the integration branch. The review applies to the pinned Node 24.21.0, Void 0.26.0, Hono 4.13.13 and Vite 8.3.3 baseline; successful CI on the exact integration head remains the merge gate.

| PRs | Reviewed boundary and evidence |
| --- | --- |
| #14–#15 | Void route discovery and loader protocol, SSR/client-only output, serialized props and server-only module isolation. |
| #16–#17 | Shared router integration, native-link behavior, cancellation/recovery, layout identity, page resets and shared request data. |
| #18–#19 | Action methods, named actions, input/error retention, duplicate/cancellation handling, head replacement, escaped values and inert script metadata. |
| #20 | ESM/type exports, exact framework peers, server/browser module selection and provider identity in a clean packed consumer. |
| #21–#23 | Island props/client isolation, explicit unsupported-mode diagnostics, deferred buffering and stale-page isolation, native static HTML/page-data output. |
| #24 | Page/loader reloads, route discovery invalidation, single browser initialization and actionable compatibility checks. |
| #25–#28 | English contribution/release documentation, current-tree/tarball audits, native local ISR success/failure behavior, completion evidence and MIT distribution metadata. |
| #29 | Active CI, a repaired lockfile layout preserving all locked artifacts, and source-browser regression coverage. |

## Review corrections

Concurrent page and loader edits could return HTTP 500: an in-flight renderer retained its old providers but dynamically imported a page from the new worker-module generation. The failure reproduced locally in the added concurrent-request regression before the fix. Development SSR now eagerly captures server-rendered pages and layouts with its renderer/providers. Browser-only pages stay outside that server snapshot, and production retains lazy component loading. Module invalidation is restricted to the changed modules and Pages virtual entries. The locked packed consumer passes six simultaneous page/loader revisions with parallel SSR requests, browser reload/state checks, and the existing production/static/deferred/ISR suites after the fix. Development now loads all SSR page modules when creating the renderer, so their server-side module initialization occurs at that point rather than at the first route request.

The packed-consumer suite covers the package/runtime boundary but did not reproduce the source example's detailed forms and head checks in CI. `npm run check:source` now builds the Pages example and runs Playwright checks in development and production preview. It covers navigation/history/refresh, competing navigation and failure recovery, layout retention/removal, shared data/params, CRUD and named actions, validation/input retention, duplicate submission/cancellation/redirects, head replacement/escaping and inert script reinsertion. A local run with installed Chrome passed in both modes.

The package guide's outdated workflow/authentication blocker is corrected. CI runs both this source regression and the existing locked packed-consumer suite. The actual Actions result on the current commit is the merge gate.

## Integration and remaining scope

Integrate from the last PR into each preceding dependency branch, preserving merge history. At each step verify the exact current head, successful CI and an unchanged reviewed Git tree. Integrate the resulting first PR into `main`, then verify the separate post-merge `main` CI.

This review does not expand the supported framework versions, promise SSR DOM reuse or state-preserving HMR, or establish managed-edge ISR behavior. Publication, repository visibility and production deployment remain separate release actions described in the release checklist.
