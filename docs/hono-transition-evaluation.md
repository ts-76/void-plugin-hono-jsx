# Hono Transition evaluation

Issue: [#98](https://github.com/ts-76/void-plugin-hono-jsx/issues/98).
Evaluated on 2026-10-17 with Hono 4.13.13, Void 1.1.11, Vite 8.3.4,
Node 24.21.0 and Chrome. The adapter includes the local #96/#97 changes;
these additions are not part of published RC.0.

## Decision

Keep the explicit Void resource / adapter DOM commit flow. Do not add a
`startTransition` / `useTransition` adapter option in this release group.
The tested placements either change the deferred-shell contract or provide no
observed navigation improvement. This is a decision about these placements and
versions, not a claim that Hono Transition has no useful application.

`useNavigation()` continues to report Void's loading/submitting/idle state.
An app may use Hono's hooks for its own local component updates; their pending
state is not a replacement for the router's lifecycle.

## Method and observations

Start at `/transitions`, visit a page with immediate props and a controlled
deferred producer, inspect the pending state after the adapter receives its new
frame, then release the producer. The experiment changes only the `setFrame`
placement in a disposable copy of a packed-package consumer. It adds the same
hook instrumentation to the control and both variants. Each variant starts a
fresh dev server and performs a fresh production build/preview.

Native browser View Transitions are explicitly disabled during this narrow
experiment to isolate the Hono hook. This does not validate the combined
candidate with native View Transitions, cancellation, actions or history.

| Frame update | While deferred is pending, dev and preview | After producer release |
| --- | --- | --- |
| Existing update | Immediate content and Suspense fallback visible; URL `/deferred`; Void idle; visit settled | Result visible; idle |
| `startTransition(() => setFrame(...))` | Old screen retained; immediate props hidden; URL stays `/transitions`; Void loading; visit unsettled | New content/URL commit; idle |
| Hook's `start(() => setFrame(...))` | Same shell/fallback/URL and visit completion as control; hook pending already false | Result visible; idle |

All six cases completed without browser page errors. The 250ms observation
window is not a render-performance benchmark. The script asserts this table so
an upstream behavior change fails the experiment rather than silently preserving
the written conclusion.

The first variant delays a shell that Void deliberately makes available before
deferred results. Adopting it would require a new, explicit contract for shell
visibility, commit, URL/head/scroll, cancellation and independent deferred
groups. Keeping the old URL while hiding available immediate data is not an
accepted improvement for the current contract. The hook variant did not provide
a useful pending signal for this wait.

## Why wrapping the whole async visit is insufficient

In the installed Hono source, `jsx/hooks/index.js` pushes `pendingStack` only for
the synchronous callback invocation and pops it in `finally`. A returned Promise
affects hook cleanup, but does not carry that context into later `await`
continuations. Wrapping the start of a network visit therefore does not mark the
adapter's later frame update as a Transition.

`jsx/dom/render.js` suppresses a Suspense fallback when the update context is
type 1 (`startTransition`). The adapter waits for `PageFrame`'s layout effect
before allowing Void to commit history and scroll. Deferring that DOM commit
therefore also defers the router's commit; Hono pending cannot safely be used as
an alternative completion acknowledgment.

Hono `startTransition`/`useTransition` and the browser's `document.startViewTransition`
are separate APIs. The latter remains owned by `applyWithTransition()` around
the existing explicit DOM commit. No additional native animation or nested
View Transition is introduced.

## Reproduce

Use a retained **baseline** consumer from the checkout containing #97. Run with
the supported Node version and a Playwright browser installed:

```sh
KEEP_CONSUMER_FIXTURE=1 npm run check:consumer
node scripts/evaluate-hono-transitions.mjs \
  --consumer /absolute/path/to/retained/consumer \
  --output /tmp/hono-transition-results.json
```

Use `PLAYWRIGHT_CHANNEL` to select another installed channel. The experiment
checks the private fixture identity, copies it with dependencies into a new
temporary directory, restores the shared Pages fixture in that copy (the full
checker finishes with static/ISR fixtures), patches only the copied client, and
deletes its servers and copy
afterward. The original consumer, repository runtime and published tarball are
not patched. The output includes dependency versions, a hash of the original
installed client and each observed state. It is diagnostic evidence, not an
artifact acceptance or publication receipt.

## Reconsideration conditions

Reopen implementation when there is a specific user-visible improvement that
preserves or explicitly replaces the shell contract, and an implementation can
correlate each rendered frame with the current resource without using Hono
pending as the commit acknowledgment. Before adoption, validate fast/slow and
deferred navigation, independent groups, cancellation/late results, failure,
back/forward, GET reset, preserved layout/action state, JSON/multipart actions,
and every existing native View Transition mode in packed dev/preview consumers.

Those combined cases remain unverified for the rejected variants. The existing
consumer suites remain the regression gate for the unchanged navigation flow;
passing the narrow experiment does not satisfy them for a hypothetical future
integration.
