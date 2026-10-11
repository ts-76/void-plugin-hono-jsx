import { useForm } from '../../../packages/hono-pages/src/runtime/form';

export function EditPage({ name, submissions, named = false }: { name: string; submissions: number; named?: boolean }) {
  const form = useForm({ name });
  const url = named ? '/named?save' : '/edit';
  return <main id="page-content" className="page-content">
    <div className="page-heading"><div><h1>{named ? '名前付きアクション' : '名前の編集'}</h1><p>名前を入力して保存し、サーバーへの送信と入力チェックを確認できます。</p></div></div>
    <div className="content-grid form-grid"><section className="panel"><div className="panel-heading"><h2>名前を変更</h2><p>保存する名前を入力してください。</p></div>
    <form onSubmit={(event) => { event.preventDefault(); void form.post(url); }}>
      <div className="field"><label htmlFor="name">名前 <span className="required-label">必須</span></label><input id="name" autoComplete="off" aria-invalid={String(Boolean(form.errors.name))} aria-describedby="name-hint name-error" value={form.data.name} onInput={(event) => {
        const input = event.currentTarget;
        if (input instanceof HTMLInputElement) form.setData({ name: input.value });
      }} /><p id="name-hint" className="field-hint">空欄で保存すると、入力エラーを確認できます。</p><p id="name-error" className="field-error" role={form.errors.name ? 'alert' : undefined}>{form.errors.name}</p></div>
      <div className="form-actions"><button className="button button-primary" id="save" disabled={form.pending}>{form.pending ? '保存中…' : '変更を保存'}</button><button className="button" type="button" id="reset-form" onClick={form.reset}>入力を戻す</button><button className="button button-quiet" type="button" id="cancel" disabled={!form.pending} onClick={form.cancel}>送信を中止</button></div>
      <p className="form-feedback" role="status">{form.pending ? 'サーバーに送信しています。' : form.wasSuccessful ? '変更を保存しました。' : '保存すると、保存結果に反映されます。'}</p>
      {form.error && !form.errors.name && <p className="error-notice" role="alert">{form.error.message}</p>}
      <div className="action-tools"><h3>追加の検証操作</h3><p>別の HTTP メソッドや応答を試せます。</p><div className="button-row"><button className="button" type="button" id="put" disabled={form.pending} onClick={() => void form.put(url)}>PUT</button><button className="button" type="button" id="patch" disabled={form.pending} onClick={() => void form.patch(url)}>PATCH</button><button className="button" type="button" id="delete" disabled={form.pending} onClick={() => void form.delete(url)}>DELETE</button>
      {named && <><button className="button" type="button" id="redirect" disabled={form.pending} onClick={() => void form.post('/named?redirect')}>リダイレクト</button><button className="button" type="button" id="fail" disabled={form.pending} onClick={() => void form.post('/named?fail')}>エラー応答</button><button className="button" type="button" id="slow" disabled={form.pending} onClick={() => void form.post('/named?slow')}>遅い保存</button></>}</div></div>
    </form></section><section className="panel"><div className="panel-heading"><h2>保存結果</h2><p>サーバーに保存されている最新の値</p></div><dl className="data-list"><div><dt>保存済みの名前</dt><dd><output id="saved-name">{name}</output></dd></div><div><dt>送信回数</dt><dd><output id="submissions">{submissions}</output></dd></div></dl><p className="panel-description">検証用の一時データです。別の検証操作でも送信回数が変わります。</p></section></div>
    <output aria-hidden="true" className="visually-hidden" id="form-pending">{String(form.pending)}</output><output aria-hidden="true" className="visually-hidden" id="form-success">{String(form.wasSuccessful)}</output>
  </main>;
}
