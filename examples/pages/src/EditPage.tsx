import { useForm } from '../../../runtime/form';
import { Navigation } from './Navigation';

export function EditPage({ name, submissions, named = false }: { name: string; submissions: number; named?: boolean }) {
  const form = useForm({ name });
  const url = named ? '/named?save' : '/edit';
  return <main>
    <Navigation />
    <h1>Edit name</h1>
    <p>Saved name: <output id="saved-name">{name}</output></p>
    <p>Submissions: <output id="submissions">{submissions}</output></p>
    <form onSubmit={(event) => { event.preventDefault(); void form.post(url); }}>
      <label>Name <input id="name" value={form.data.name} onInput={(event) => {
        const input = event.currentTarget;
        if (input instanceof HTMLInputElement) form.setData({ name: input.value });
      }} /></label>
      <p id="name-error">{form.errors.name}</p>
      <button id="save" disabled={form.pending}>Save</button>
      <button type="button" id="put" onClick={() => void form.put(url)}>Put</button>
      <button type="button" id="patch" onClick={() => void form.patch(url)}>Patch</button>
      <button type="button" id="delete" onClick={() => void form.delete(url)}>Delete</button>
      {named && <>
        <button type="button" id="redirect" onClick={() => void form.post('/named?redirect')}>Redirect</button>
        <button type="button" id="fail" onClick={() => void form.post('/named?fail')}>Fail</button>
        <button type="button" id="slow" onClick={() => void form.post('/named?slow')}>Slow save</button>
      </>}
      <button type="button" id="cancel" onClick={form.cancel}>Cancel</button>
      <button type="button" id="reset-form" onClick={form.reset}>Reset</button>
    </form>
    <output id="form-pending">{String(form.pending)}</output>
    <output id="form-success">{String(form.wasSuccessful)}</output>
    {form.error && !form.errors.name && <p role="alert">{form.error.message}</p>}
  </main>;
}
