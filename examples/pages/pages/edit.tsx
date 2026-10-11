import { EditPage } from '../src/EditPage';
import type { InferProps } from 'void';
import type { loader } from './edit.server';
export default function Page(props: InferProps<typeof loader>) { return <EditPage {...props} />; }
