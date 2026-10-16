import Counter from '../../components/MarkdownCounter' with { island: 'load' };
export default function Layout({ children }: { children: unknown }) { return <div><Counter name="layout" initial="2" />{children}</div>; }
