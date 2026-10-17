import Counter from '../components/Counter' with { island: 'load' };
export const layout = false;
export default function Island() { return <main><h1>RC island</h1><Counter /><a href="/">Home</a></main>; }
