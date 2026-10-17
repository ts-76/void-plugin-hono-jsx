import MultipartIsland from '../components/MultipartIsland' with { island: 'load' };
export default function Page({ result }: { result: unknown }) {
  return <main><h1>Multipart island</h1><output id="island-multipart-result">{JSON.stringify(result)}</output><MultipartIsland /></main>;
}
