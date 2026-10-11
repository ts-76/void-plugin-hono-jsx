import { Link, useRouter } from 'void-plugin-hono-jsx/pages';
export default function Page() {
  return <main><h1 id="other-heading">Other page</h1><p>{useRouter().path}</p><Link id="home" href="/">Home</Link></main>;
}
