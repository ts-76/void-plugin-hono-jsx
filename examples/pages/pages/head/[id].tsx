import type { Props } from './[id].server';
import { Link, useRouter } from '../../../../packages/hono-pages/src/runtime/pages';
export default function Page({ id }: Props) {
  const router = useRouter();
  return <main id="page-content" className="page-content"><div className="page-heading"><div><h1>ページのメタデータ</h1><p>ページを切り替えると、ブラウザのタイトルやメタタグが更新されます。</p></div></div><section className="panel"><div className="panel-heading"><h2>表示中のページ: {id}</h2><p>ブラウザのタブタイトルを確認しながら切り替えてください。</p></div><div className="button-row"><Link className="button" id="head-one" href="/head/one">One</Link><Link className="button" id="head-two" href="/head/two">Two</Link><Link className="button" id="head-default" href="/about">デフォルト</Link><button className="button button-primary" id="head-refresh" onClick={() => void router.refresh()}>再取得</button></div></section></main>;
}
