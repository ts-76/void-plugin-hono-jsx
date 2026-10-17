import { useState } from 'hono/jsx';
import { useFrontmatter } from '../../../packages/hono-pages/src/runtime/markdown';

export default function MarkdownCounter({ name, label, initial }: { name: string; label: string; initial: string }) {
  const initialCount = Number(initial);
  const [count, setCount] = useState(initialCount);
  const frontmatter = useFrontmatter<{ title: string }>();
  return <section className="markdown-counter" aria-label={label}>
    <h3>{label}</h3>
    <p className="muted">初期値 {initialCount} ・ <span id={name + '-frontmatter'}>{frontmatter.title}</span></p>
    <div className="counter-controls"><output id={name + '-value'} aria-live="polite">{count}</output><button className="button button-primary" type="button" id={name + '-increment'} onClick={() => setCount(value => value + 1)}>+1 増やす</button><button className="button" type="button" onClick={() => setCount(initialCount)}>リセット</button></div>
  </section>;
}
