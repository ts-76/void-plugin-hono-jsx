import type { PropsWithChildren } from 'hono/jsx';
import Wrapper from '../../../components/StaticIslandWrapper';
export default function Layout({ children }: PropsWithChildren) { return <section id="graph-nested"><Wrapper id="nested" />{children}</section>; }
