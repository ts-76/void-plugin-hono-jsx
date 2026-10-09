import type { Props } from './[id].server';
import { Link, useRouter } from '../../../../runtime/pages';
export default function Page({ id }: Props) {
  const router = useRouter();
  return <main><h1>Head page {id}</h1>
    <Link id="head-one" href="/head/one">One</Link>{' '}
    <Link id="head-two" href="/head/two">Two</Link>{' '}
    <Link id="head-default" href="/about">Defaults</Link>{' '}
    <button id="head-refresh" onClick={() => void router.refresh()}>Refresh</button>
  </main>;
}
