import {
  useForm,
  action,
  isCallSiteActionError,
  isVoidActionError,
  type InferProps,
  type VoidActionError,
} from 'void-plugin-hono-jsx';
import type { loader } from './index.server.ts';
// Root re-exports of Void's action error helpers and loader prop inference.
function checkRootHelpers(failure: unknown): VoidActionError | null {
  const props: InferProps<typeof loader> = { initialCount: 1 };
  void props;
  if (isCallSiteActionError(failure)) return failure;
  return isVoidActionError(failure) ? failure : null;
}
void checkRootHelpers;
function checkBound() {
  const form = useForm('/forms?save', { name: 'Original', note: 'Default' });
  form.setData('name', 'New');
  form.reset({ initial: true }, 'name');
  form.clearErrors('note');
  form.setError('name', 'Required');
  // @ts-expect-error unknown field
  form.setError('missing', 'Required');
  form.post();
  const data = new FormData();
  form.post({ data });
  form.submit('put', { data });
  form.post({ data: { name: 'Override', note: 'Kept' } });
  // @ts-expect-error unknown field
  form.setData('missing', 'New');
  // @ts-expect-error wrong field value
  form.setData('name', 0);
  // @ts-expect-error submissions cannot override the action URL
  form.post('/forms?save');
  // @ts-expect-error form construction requires an action URL
  useForm({ name: 'Original' });
  // @ts-expect-error unknown action URL
  useForm('/missing?save', { name: 'Original' });
  // @ts-expect-error unknown one-shot action URL
  action('/missing?save');
}
void checkBound;
