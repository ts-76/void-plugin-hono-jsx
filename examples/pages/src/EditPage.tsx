import { useForm } from '../../../packages/void-plugin-hono-jsx/src/runtime/pages/form';

export function EditPage({
  name,
  submissions,
  named = false,
}: {
  name: string;
  submissions: number;
  named?: boolean;
}) {
  const url = named ? '/named?save' : '/edit';
  const form = useForm(url, { name });
  const slow = useForm('/named?slow', { name });
  const failure = useForm('/named?fail', { name });
  const redirect = useForm('/named?redirect', {});
  const pending = form.pending || slow.pending || failure.pending || redirect.pending;
  const error = failure.error ?? slow.error ?? redirect.error ?? form.error;
  return (
    <main id="page-content" className="page-content">
      <div className="page-heading">
        <div>
          <h1>{named ? '名前付きアクション' : '名前の編集'}</h1>
          <p>名前を入力して保存し、サーバーへの送信と入力チェックを確認できます。</p>
        </div>
      </div>
      <div className="content-grid form-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>名前を変更</h2>
            <p>保存する名前を入力してください。</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              failure.clearError();
              void form.post();
            }}
          >
            <div className="field">
              <label htmlFor="name">
                名前 <span className="required-label">必須</span>
              </label>
              <input
                id="name"
                autoComplete="off"
                aria-invalid={String(Boolean(form.errors.name))}
                aria-describedby="name-hint name-error"
                value={form.data.name}
                onInput={(event) => {
                  const input = event.currentTarget;
                  if (input instanceof HTMLInputElement) form.setData({ name: input.value });
                }}
              />
              <p id="name-hint" className="field-hint">
                空欄で保存すると、入力エラーを確認できます。
              </p>
              <p
                id="name-error"
                className="field-error"
                role={form.errors.name ? 'alert' : undefined}
              >
                {form.errors.name}
              </p>
            </div>
            <div className="form-actions">
              <button className="button button-primary" id="save" disabled={pending}>
                {pending ? '保存中…' : '変更を保存'}
              </button>
              <button className="button" type="button" id="reset-form" onClick={form.reset}>
                保存時の入力に戻す
              </button>
              <button
                className="button button-quiet"
                type="button"
                id="reset-initial"
                onClick={() => form.reset({ initial: true })}
              >
                最初の入力に戻す
              </button>
              <button
                className="button button-quiet"
                type="button"
                id="cancel"
                disabled={!pending}
                onClick={slow.pending ? slow.cancel : form.cancel}
              >
                送信を中止
              </button>
            </div>
            <p className="form-feedback" role="status">
              {pending
                ? 'サーバーに送信しています。'
                : form.wasSuccessful
                  ? '変更を保存しました。'
                  : '保存すると、保存結果に反映されます。'}
            </p>
            {error && !form.errors.name && (
              <p className="error-notice" role="alert">
                {error.message}
              </p>
            )}
            <div className="action-tools">
              <h3>追加の検証操作</h3>
              <p>別の HTTP メソッドや応答を試せます。</p>
              <div className="button-row">
                <button
                  className="button"
                  type="button"
                  id="put"
                  disabled={pending}
                  onClick={() => void form.put()}
                >
                  PUT
                </button>
                <button
                  className="button"
                  type="button"
                  id="patch"
                  disabled={pending}
                  onClick={() => void form.patch()}
                >
                  PATCH
                </button>
                <button
                  className="button"
                  type="button"
                  id="delete"
                  disabled={pending}
                  onClick={() => void form.delete()}
                >
                  DELETE
                </button>
                {named && (
                  <>
                    <button
                      className="button"
                      type="button"
                      id="redirect"
                      disabled={pending}
                      onClick={() => void redirect.post()}
                    >
                      リダイレクト
                    </button>
                    <button
                      className="button"
                      type="button"
                      id="fail"
                      disabled={pending}
                      onClick={() => void failure.post({ data: form.data })}
                    >
                      エラー応答
                    </button>
                    <button
                      className="button"
                      type="button"
                      id="slow"
                      disabled={pending}
                      onClick={() => void slow.post({ data: form.data })}
                    >
                      遅い保存
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>保存結果</h2>
            <p>サーバーに保存されている最新の値</p>
          </div>
          <dl className="data-list">
            <div>
              <dt>保存済みの名前</dt>
              <dd>
                <output id="saved-name">{name}</output>
              </dd>
            </div>
            <div>
              <dt>送信回数</dt>
              <dd>
                <output id="submissions">{submissions}</output>
              </dd>
            </div>
          </dl>
          <p className="panel-description">
            検証用の一時データです。別の検証操作でも送信回数が変わります。
          </p>
        </section>
      </div>
      <output aria-hidden="true" className="visually-hidden" id="form-pending">
        {String(pending)}
      </output>
      <output aria-hidden="true" className="visually-hidden" id="form-success">
        {String(form.wasSuccessful)}
      </output>
      <output aria-hidden="true" className="visually-hidden" id="slow-success">
        {String(slow.wasSuccessful)}
      </output>
    </main>
  );
}
