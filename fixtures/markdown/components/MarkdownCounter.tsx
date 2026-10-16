import { useState } from 'hono/jsx';
import { useFrontmatter } from 'void-plugin-hono-jsx/markdown';
export default function Counter({ name, initial }: { name: string; initial: string }) { const [count, setCount] = useState(Number(initial)); return <div><output id={name + '-value'}>{count}</output><output id={name + '-frontmatter'}>{String(useFrontmatter().title)}</output><button id={name + '-increment'} onClick={() => setCount(value => value + 1)}>Increment</button></div>; }
