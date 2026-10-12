import IslandForm from '../components/IslandForm' with { island: 'load' };
export const layout = false;
export default function Page({ saved, submissions }: { saved: string; submissions: number }) { return <main><h1>Island form</h1><IslandForm saved={saved} submissions={submissions} /></main>; }
