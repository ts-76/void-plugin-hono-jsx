export {
  Link,
  useErrors,
  useNavigation,
  useParams,
  useRouter,
  useShared,
  deferredResult,
  HonoStyles,
  type Deferred,
  type DeferredResult,
  type LinkProps,
  type NavigationFallbackProps,
  type PrefetchStrategy,
} from './pages/api.tsx';
export {
  Form,
  action,
  useForm,
  useIslandForm,
  type FormProps,
  type FormSubmitOptions,
  type HonoForm,
} from './pages/form.ts';
// Same helpers as the official adapters, so action errors can be narrowed without importing Void internals.
export { isCallSiteActionError, isVoidActionError, type VoidActionError } from 'void/pages-client';
export type { InferProps } from 'void';
