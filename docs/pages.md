# Pages, navigation and forms

Configure the adapter with the [setup guide](../packages/hono-pages/README.md).
Void discovers routes and runs loaders/actions; components use Hono JSX.

## Navigation

```tsx
import { Link, useNavigation, useRouter } from 'void-plugin-hono-jsx/pages';

export default function Page() {
  const navigation = useNavigation();
  const router = useRouter();
  return <main>
    <Link href="/users" prefetch="hover">Users</Link>
    <button onClick={() => router.refresh()}>Refresh</button>
    {navigation.state !== 'idle' && <p role="status">Loading…</p>}
  </main>;
}
```

`Link` and `useRouter()` use Void's shared navigation engine.

| Option | Behavior |
| --- | --- |
| `method`, `data` | GET data becomes query parameters. Mutation links render buttons. |
| `preserveState`, `preserveScroll`, `replace` | Control page state, scroll and browser history. |
| `reloadDocument` | Use a normal document request; GET only. |
| `prefetch` | `true` (hover), `hover`, `click`, `mount`, `visible`, or an array. GET only. |
| `cacheFor` | Prefetch cache duration or stale/expiry tuple. |
| `onNavigate` | Cancel navigation with `preventDefault()`. |
| `viewTransition` | Override the plugin's View Transition setting for a visit. |

External URLs, downloads and links with a target retain native browser behavior.
An event handler can prevent the adapter's action.
GET visits reset page state; refresh preserves it. Layouts retain state while they remain in the active chain.

`useNavigation()` exposes reactive `state`, `location` and `method` fields.
States are `idle`, `loading` and `submitting`; SSR starts idle.
`useShared()`, `useParams()` and `useErrors()` expose shared data, route parameters and field errors in SSR and browser components.

### Prefetch and View Transitions

```ts
voidHonoJsx({
  viewTransitions: true,
  prefetch: { hoverDelay: 75, cacheFor: '30s' },
});
```

View Transitions default to disabled. Prefetch defaults to a 75 ms hover delay and a 30 s cache duration.
Use `<Link viewTransition={false}>` or `router.visit(url, { viewTransition: true })` for individual visits.
Browsers without View Transitions use normal navigation. Transitions wait for the Hono DOM commit and head update.

### Navigation fallback

Register a default-exported TSX/JSX component by local path:

```ts
voidHonoJsx({
  navigationFallback: {
    component: './components/NavigationFallback.tsx',
    delay: 150,
  },
});
```

```tsx
import type { NavigationFallbackProps } from 'void-plugin-hono-jsx/pages';

export default function NavigationFallback({ navigation }: NavigationFallbackProps) {
  return <p>Loading {navigation.location?.pathname}…</p>;
}
```

The fallback appears during GET navigation after the delay (default 150 ms).
The current page stays mounted and interactive. Completion, failure or a superseding visit removes the fallback.
A fallback render error hides it for that visit and reports a navigation error.
Forms use their own pending state; SSR emits no navigation fallback.

### Head and render errors

Void resolves head metadata. The adapter synchronizes document attributes and inert script metadata.
Navigation does not execute newly inserted scripts. Escape `<` when assigning dynamic JSON-LD to `script.innerHTML`.

If a page or layout throws during navigation, the visit rejects and returns to idle.
The URL and head stay on the last successful page. Recovery rebuilds that page and its layouts, resetting local state.

## Forms

```tsx
import { Form, useForm } from 'void-plugin-hono-jsx/form';

export default function Profile() {
  const form = useForm('/profile?save', { name: '' });
  return <Form form={form}>
    <input value={form.data.name}
      onInput={(event) => form.setData('name', event.currentTarget.value)} />
    <button type="submit">Save</button>
  </Form>;
}
```

JSON is the default body: `Form` submits `form.data`.
`useForm(defaults)` is also supported; supply a URL to its submission method or the `Form` component.

| API | Purpose |
| --- | --- |
| `post`, `put`, `patch`, `delete` | Submit to the bound or explicit URL, including named actions. |
| `setData` | Set a field, a complete object or an updater. |
| `hasChanges` | Compare the JSON model with its defaults. |
| `reset`, `clearErrors`, `clearError` | Reset selected fields or clear errors. |
| `recentlySuccessful` | Success indicator lasting two seconds. |
| `action(url, options)` | Perform one action through the initialized Pages router. |

A successful bound JSON submission becomes the new defaults.
`Form` renders field/action errors; customize them with `renderError`.
Duplicate submissions are suppressed. Quota retry deadlines are respected without automatic retries.
Cancellation prevents stale UI updates but cannot undo server writes.

### Multipart forms

```tsx
const form = useForm('/profile?save', { name: 'Initial' });
return <Form form={form} encType="multipart/form-data">
  <input name="name" value="Initial" />
  <input name="files" type="file" multiple />
  <button name="intent" value="save">Save</button>
</Form>;
```

Named fields, files, repeated names and the clicked submitter are included.
For direct submission, use `form.post(data)`, `form.post('/profile?save', data)` or `form.submit('patch', data)` with `FormData`.
All four mutation methods accept it; unbound forms require a URL.
The adapter snapshots the body and leaves `Content-Type` to fetch so the multipart boundary is correct.

Full Pages sends a same-origin mutation, then one GET through Void's router on success.
The destination must support GET. Layout state is preserved, but loaders and deferred data can rerun.
JSON mutation's resolved-deferred retention does not apply to multipart.
The one-shot `action()` helper does not accept this multipart transport.

Validation retains native field/file values.
`data`, `hasChanges` and `reset()` still describe the JSON model; use native form reset for uncontrolled fields and files.

For islands, use `useIslandForm(defaults)` and provide `url` to `Form`.
Success reloads or redirects the document. See [islands](#islands).

## Deferred loader props

Return `defer(() => slowOperation())` from a Void loader.
Read the resulting `Deferred<T>` discriminated union:

```tsx
import type { Deferred } from 'void-plugin-hono-jsx/pages';

function Result({ slow }: { slow: Deferred<string> }) {
  if (slow.loading) return <p>Loading…</p>;
  if (slow.error) return <p role="alert">{slow.error.message}</p>;
  return <p>{slow.value}</p>;
}
```

Void delivers results through its HTML/NDJSON protocol. Completions update the current page without resetting local or surviving layout state.
Old navigation resources are disposed; updates for inactive props are ignored.
JSON actions retain resolved deferred values until the next load/navigation.

### Hono use() and Suspense

`deferredResult(state)` returns a stable render-only Promise for Hono `use()`.
It fulfills with `{ value, error }`; the Promise itself never rejects.

```tsx
import { ErrorBoundary, Suspense, use, useState } from 'hono/jsx';
import { deferredResult, type Deferred, type DeferredResult } from 'void-plugin-hono-jsx/pages';

function Result({ result }: { result: DeferredResult<string> }) {
  if (result.error) throw result.error;
  return <p>{result.value}</p>;
}

function Value({ slow }: { slow: Deferred<string> }) {
  const [failed, setFailed] = useState<DeferredResult<string> | null>(null);
  const result = use(deferredResult(slow));
  const fallback = <p role="alert">Could not load data.</p>;
  if (failed === result) return fallback;
  return <ErrorBoundary fallback={fallback}
    onError={() => queueMicrotask(() => setFailed(result))}>
    <Result result={result} />
  </ErrorBoundary>;
}

export default function Page({ slow }: { slow: Deferred<string> }) {
  return <Suspense fallback={<p>Loading…</p>}><Value slow={slow} /></Suspense>;
}
```

Throw result errors in a child of `ErrorBoundary`, after `use()` returns.
Remembering the failed result prevents Hono 4 from repeatedly throwing that child during parent updates.
Keep the resource within its page; do not cache it globally or start another fetch.

SSR uses an inert pending Promise to emit the fallback. Never await this helper on the server.
Void delivers the result to the browser; the adapter sends no Hono replacement HTML.

### Deferred limitations

- Full Pages only: deferred islands and static deferred output are unsupported.
- Failed prefetch can resolve to `null`; use document/SPA streaming when error state is needed.
- Grouped projections need explicit prop types with the current Void `defer<T>` declaration.
- Development can expose resolver error messages. Production uses `Internal Server Error` for ordinary errors, but may forward deliberate HTTP exception messages. Keep those messages safe for users.

## Islands

Use `.island.tsx` or `.island.jsx` pages for static server content:

```tsx
import Counter from '../components/Counter' with { island: 'load' };

export const layout = false;
export default function Page() {
  return <main><p>Static content</p><Counter initialCount={9} /></main>;
}
```

Place interactive components outside the pages directory. Use ordinary Hono hooks and event handlers inside them.
Props must be JSON-serializable. Supported policies are `load`, `visible`, `idle` and `media:(query)`.
Each island mounts once; mounting redraws its server HTML.

Use a default relative TSX/JSX import with its attribute in the static page, layout or component graph.
Nested static components, named layouts and repeated islands with independent props are supported.
Inside an interactive component, use ordinary imports: nested attributed islands are rejected.
Unknown policies and malformed media queries produce diagnostics.

`useIslandForm(defaults)` provides form state without a Pages provider.
Submit to an explicit same-origin URL or use `<Form form={form} url="/blog?save">`.
JSON and explicit multipart bodies are supported. Success reloads or redirects the document.
`useForm` and `action` require full Pages; use named `useIslandForm`/`Form` imports in islands.
Ambiguous namespace/default form imports are rejected.

Use document links in static island pages. Pages navigation falls back to a document request for island routes.
Static layouts do not retain interactive state, and full Pages cannot inherit an island layout.
A static-only chain without authored scripts or Markdown copy controls sends no client script or module preload.

## Static output and prerendering

Set `output: 'static'` in `void.config.ts`, then run `vite build`.
Void generates HTML and `/_void/pages/*.json` under `dist/client`.
Declare dynamic paths in the companion server module:

```ts
import { defineHandler } from 'void';

export const prerender = true;
export const getPrerenderPaths = () => [{ id: 'alice' }, { id: 'bob' }];
export const loader = defineHandler((c) => ({ id: c.req.param('id') }));
```

Known routes are prerendered automatically in static output.
`prerender = false` excludes a route. Excluded routes and undeclared dynamic paths require a server.
Serve clean URLs such as `/users/alice` from `users/alice.html`, keeping assets and Pages JSON available.

Actions require a server and are rejected during static discovery.
Deferred static routes fail rendering. Void may continue with a warning and omit failed paths, so verify the expected output files.
See `fixtures/static` and [local ISR](isr.md) for separate output/cache examples.
