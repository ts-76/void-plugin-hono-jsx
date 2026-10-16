import Idle from '../components/PolicyCounter' with { island: 'idle' };
import Visible from '../components/PolicyCounter' with { island: 'visible' };
import Media from '../components/PolicyCounter' with { island: 'media:(max-width: 600px)' };
export const layout = false;
export default function Page() {
  return <main><h1>Island policies</h1><Idle id="idle" /><Media id="media" /><section style="margin-top: 2000px"><Visible id="visible" /></section></main>;
}
