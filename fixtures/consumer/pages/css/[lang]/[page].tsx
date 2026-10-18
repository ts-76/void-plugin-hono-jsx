import { useState } from 'hono/jsx';
import { css, cx } from 'hono/css';
import { HonoStyles, Link } from 'void-plugin-hono-jsx/pages';
import type { Props } from './[page].server';
import '../../../css-override.css';
export const layout = false;
export default function Page({ lang, page, theme, nonce }: Props) {
  const [count, setCount] = useState(0);
  const href = (nextPage = page, nextLang = lang, nextTheme = theme) => `/css/${nextLang}/${nextPage}?theme=${nextTheme}`;
  return <><HonoStyles nonce={nonce} /><main id="css-page" class={css`max-width:48rem;padding:16px;`}>
    <h1>{lang === 'ja' ? 'スタイル検証' : 'Style verification'}</h1>
    <article id="css-card" class={cx('css-card', css`border-radius:4px;padding:16px;background:${theme === 'dark' ? 'rgb(20,30,40)' : 'rgb(240,245,250)'};color:${page === 'two' ? 'rgb(65,45,125)' : 'rgb(15,85,45)'};`)}>{lang === 'ja' ? '初回表示と画面遷移のスタイル' : 'Styles on first load and navigation'} {page}</article>
    <output id="css-count">{count}</output><button id="css-increment" onClick={() => setCount(value => value + 1)}>+</button>
    <nav><Link id="css-next" href={href(page === 'one' ? 'two' : 'one')}>Next</Link> <Link id="css-language" href={href(page, lang === 'ja' ? 'en' : 'ja')}>Language</Link> <Link id="css-theme" href={href(page, lang, theme === 'dark' ? 'light' : 'dark')}>Theme</Link></nav>
  </main></>;
}
