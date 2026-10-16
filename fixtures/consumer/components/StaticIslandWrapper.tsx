import Counter from './PolicyCounter' with { island: 'load' };
export default function Wrapper({ id }: { id: string }) { return <div><Counter id={id} /></div>; }
